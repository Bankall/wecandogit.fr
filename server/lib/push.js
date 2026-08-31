import webpush from "web-push";
import config from "config";

import { query } from "./db.js";
import { getNotification, toPlainText } from "./notification.js";

/*
 * Web Push (VAPID) notifications for trainers: when something happens on a
 * trainer's own slot or package, their device gets an OS notification even when
 * the site is closed.
 *
 * The whole feature is optional: with no VAPID keys in the environment nothing
 * is ever sent and no endpoint offers to subscribe. Generate a key pair once
 * with `npx web-push generate-vapid-keys` and put it in server/.env.
 */

/*
 * Read lazily rather than at import time: this module must not care whether
 * dotenv has already run when it is first imported.
 */
const getVapidDetails = () => {
	const publicKey = process.env.VAPID_PUBLIC_KEY;
	const privateKey = process.env.VAPID_PRIVATE_KEY;

	if (!publicKey || !privateKey) {
		return null;
	}

	return { subject: process.env.VAPID_SUBJECT || "mailto:contact@wecandogit.com", publicKey, privateKey };
};

const isPushConfigured = () => !!getVapidDetails();

const getPublicKey = () => getVapidDetails()?.publicKey || null;

/*
 * One row per browser/device. `endpoint` is the unique push service URL the
 * browser gives us; re-subscribing with the same endpoint must not duplicate.
 */
const saveSubscription = async ({ id_user, subscription, user_agent = null }) => {
	if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
		return false;
	}

	await query(
		`INSERT INTO push_subscription (id_user, endpoint, p256dh, auth, user_agent)
		VALUES (?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE id_user = VALUES(id_user), p256dh = VALUES(p256dh), auth = VALUES(auth), user_agent = VALUES(user_agent)`,
		[id_user, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth, user_agent ? user_agent.slice(0, 255) : null]
	);

	return true;
};

const deleteSubscription = async endpoint => {
	if (!endpoint) {
		return;
	}

	await query("DELETE FROM push_subscription WHERE endpoint = ?", [endpoint]);
};

const countSubscriptions = async id_user => {
	const rows = await query("SELECT count(*) total FROM push_subscription WHERE id_user = ?", [id_user]);
	return rows[0]?.total || 0;
};

/*
 * Sends to every device of a user. A push service answering 404/410 means the
 * subscription is dead (browser data cleared, app uninstalled): we drop it so
 * the table does not grow stale endpoints forever.
 */
const sendToUser = async ({ id_user, payload }) => {
	const vapid = getVapidDetails();

	if (!vapid || !id_user) {
		return { sent: 0, failed: 0 };
	}

	webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

	const subscriptions = await query("SELECT endpoint, p256dh, auth FROM push_subscription WHERE id_user = ?", [id_user]);
	const body = JSON.stringify(payload);

	let sent = 0;
	let failed = 0;

	for (const row of subscriptions) {
		try {
			await webpush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, body, { TTL: 24 * 60 * 60, urgency: "normal" });
			sent += 1;
		} catch (err) {
			failed += 1;

			if (err?.statusCode === 404 || err?.statusCode === 410) {
				await deleteSubscription(row.endpoint);
			} else {
				console.log("Push failed:", err?.statusCode, err?.body || err?.message);
			}
		}
	}

	return { sent, failed };
};

/*
 * Pushes a freshly created notification to the trainer it concerns. The owning
 * trainer is derived from the slot/package (see lib/notification.js); events on
 * legacy rows owned by a non-trainer account simply reach nobody.
 */
const pushNotificationToTrainer = async id_notification => {
	if (!isPushConfigured() || !id_notification) {
		return;
	}

	const notification = await getNotification(id_notification);

	if (!notification?.id_trainer) {
		return;
	}

	const trainers = await query("SELECT id FROM user WHERE id = ? AND is_trainer = 1", [notification.id_trainer]);

	if (!trainers.length) {
		return;
	}

	await sendToUser({
		id_user: notification.id_trainer,
		payload: {
			title: notification.type === "slot" ? "Nouvelle activité sur un créneau" : "Nouvelle activité sur une formule",
			body: toPlainText(notification),
			// Collapses repeated notifications about the same slot/package into
			// one entry on the device instead of stacking them up.
			tag: `${notification.type}-${notification.id}`,
			url: `${config.get("FRONT_URI")}/account/notifications`
		}
	});
};

export { isPushConfigured, getPublicKey, saveSubscription, deleteSubscription, countSubscriptions, sendToUser, pushNotificationToTrainer };
