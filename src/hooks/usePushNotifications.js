import { useState, useEffect, useCallback } from "react";
import axios from "axios";

/*
 * Web Push subscription lifecycle for the trainers' device notifications.
 *
 * The browser holds the subscription (one per device/browser), the server holds
 * its copy in `push_subscription` to be able to send to it. Both sides are kept
 * in sync here: subscribing registers the service worker, asks for the
 * permission, then hands the subscription to the server.
 */

const SERVICE_WORKER_URL = "/sw.js";

const isSupported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

/*
 * On iOS, Web Push only works once the site has been added to the Home Screen
 * (iOS 16.4+). Detecting it lets us explain that instead of showing a button
 * that cannot work.
 */
const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () => window.navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches;

// The VAPID public key travels as base64url; the browser wants raw bytes.
const urlBase64ToUint8Array = base64String => {
	const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
	const raw = window.atob(base64);

	return Uint8Array.from([...raw].map(char => char.charCodeAt(0)));
};

export function usePushNotifications() {
	const supported = isSupported();

	const [config, setConfig] = useState(null);
	const [subscribed, setSubscribed] = useState(false);
	const [permission, setPermission] = useState(supported ? Notification.permission : "denied");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState(false);
	const [message, setMessage] = useState(false);

	const needsInstall = isIOS() && !isStandalone();

	useEffect(() => {
		let exited = false;

		(async () => {
			try {
				const { data } = await axios.get("/push/config");

				if (exited) {
					return;
				}

				setConfig(data);

				if (!supported || !data.enabled) {
					return;
				}

				// A registration may already exist from a previous visit.
				const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_URL);
				const subscription = await registration?.pushManager.getSubscription();

				if (!exited) {
					setSubscribed(!!subscription);
				}

				/*
				 * The server drops subscriptions a push service reports as gone,
				 * and a browser can renew one behind our back. Re-sending the
				 * subscription we hold (an idempotent upsert) keeps both sides in
				 * agreement without the trainer having to press anything.
				 */
				if (subscription) {
					await axios.post("/push/subscribe", { subscription: subscription.toJSON() });
				}
			} catch (err) {
				if (!exited) {
					setError("Impossible de vérifier l'état des notifications");
				}
			}
		})();

		return () => {
			exited = true;
		};
	}, [supported]);

	const subscribe = useCallback(async () => {
		setBusy(true);
		setError(false);
		setMessage(false);

		try {
			const registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL);
			await navigator.serviceWorker.ready;

			const result = await Notification.requestPermission();
			setPermission(result);

			if (result !== "granted") {
				setError(result === "denied" ? "Notifications refusées : autorise-les dans les réglages du navigateur pour ce site" : "Autorisation non accordée");
				return;
			}

			// Reuse the existing subscription if the browser already has one,
			// otherwise the push service issues a new endpoint every time.
			const subscription =
				(await registration.pushManager.getSubscription()) ||
				(await registration.pushManager.subscribe({
					userVisibleOnly: true,
					applicationServerKey: urlBase64ToUint8Array(config.public_key)
				}));

			const { data } = await axios.post("/push/subscribe", { subscription: subscription.toJSON() });

			if (data.error) {
				setError(data.error);
				return;
			}

			setSubscribed(true);
			setMessage("Notifications activées sur cet appareil");
		} catch (err) {
			setError(err.message || "Activation impossible");
		} finally {
			setBusy(false);
		}
	}, [config]);

	const unsubscribe = useCallback(async () => {
		setBusy(true);
		setError(false);
		setMessage(false);

		try {
			const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_URL);
			const subscription = await registration?.pushManager.getSubscription();

			if (subscription) {
				await axios.post("/push/unsubscribe", { endpoint: subscription.endpoint });
				await subscription.unsubscribe();
			}

			setSubscribed(false);
			setMessage("Notifications désactivées sur cet appareil");
		} catch (err) {
			setError(err.message || "Désactivation impossible");
		} finally {
			setBusy(false);
		}
	}, []);

	const sendTest = useCallback(async () => {
		setBusy(true);
		setError(false);
		setMessage(false);

		try {
			const { data } = await axios.post("/push/test");
			setMessage(data.sent ? `Notification de test envoyée (${data.sent} appareil${data.sent > 1 ? "s" : ""})` : "Aucun appareil abonné n'a pu être joint");
		} catch (err) {
			setError(err.message || "Envoi impossible");
		} finally {
			setBusy(false);
		}
	}, []);

	return {
		supported,
		needsInstall,
		enabled: !!config?.enabled,
		loading: config === null,
		subscribed,
		permission,
		busy,
		error,
		message,
		subscribe,
		unsubscribe,
		sendTest
	};
}
