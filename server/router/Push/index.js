import { Router } from "express";

import { errorHandler } from "../../lib/utils.js";
import { isPushConfigured, getPublicKey, saveSubscription, deleteSubscription, countSubscriptions, sendToUser } from "../../lib/push.js";

/*
 * Subscription management for the trainers' device notifications. Only trainers
 * subscribe: notifications are their activity feed.
 */
const router = Router();

router.route("/ping").get((req, res) => {
	res.send("pong");
});

router.use((req, res, next) => {
	if (!req.session.is_trainer) {
		return res.send({ error: "Vous n'avez pas accès à cette ressource" });
	}

	next();
});

/*
 * The browser needs the VAPID public key to create a subscription. A null key
 * means the feature is not configured on this server, and the UI hides itself.
 */
router.route("/config").get(async (req, res) => {
	try {
		res.send({
			enabled: isPushConfigured(),
			public_key: getPublicKey(),
			subscriptions: isPushConfigured() ? await countSubscriptions(req.session.user_id) : 0
		});
	} catch (err) {
		errorHandler({ err, req, res });
	}
});

router.route("/subscribe").post(async (req, res) => {
	try {
		if (!isPushConfigured()) {
			return res.send({ error: "Les notifications ne sont pas configurées sur ce serveur" });
		}

		const saved = await saveSubscription({
			id_user: req.session.user_id,
			subscription: req.body.subscription,
			user_agent: req.headers["user-agent"]
		});

		if (!saved) {
			return res.send({ error: "Abonnement invalide" });
		}

		res.send({ ok: true });
	} catch (err) {
		errorHandler({ err, req, res });
	}
});

router.route("/unsubscribe").post(async (req, res) => {
	try {
		await deleteSubscription(req.body.endpoint);
		res.send({ ok: true });
	} catch (err) {
		errorHandler({ err, req, res });
	}
});

/*
 * Lets a trainer check that notifications really arrive on the device they just
 * enabled — silent failures are otherwise impossible to diagnose remotely.
 */
router.route("/test").post(async (req, res) => {
	try {
		const outcome = await sendToUser({
			id_user: req.session.user_id,
			payload: {
				title: "We Can Dog It",
				body: "Les notifications sont bien activées sur cet appareil.",
				tag: "test"
			}
		});

		res.send(outcome);
	} catch (err) {
		errorHandler({ err, req, res });
	}
});

const Push = () => router;

export { Push };
