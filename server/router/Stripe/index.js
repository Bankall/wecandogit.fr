import { Router, raw } from "express";
import { errorHandler } from "../../lib/utils.js";
import { getTrainerStripe } from "../../lib/stripe.js";
import { confirmCheckoutSession, markCheckoutExpired } from "../../lib/booking.js";

const router = Router();

/*
 * Webhook Stripe, un endpoint par éducateur (chaque éducateur a son propre compte Stripe).
 * À configurer dans le dashboard Stripe de chaque compte :
 *   URL : https://<domaine>/api/v1/stripe/webhook/<id_trainer>
 *   Événements : checkout.session.completed, checkout.session.expired,
 *                checkout.session.async_payment_succeeded, checkout.session.async_payment_failed
 * Le secret de signature (whsec_...) doit être enregistré dans user.stripe_whsec.
 *
 * Ce routeur doit être monté AVANT le parseur JSON global : la vérification de
 * signature exige le corps brut de la requête.
 */
router.post("/webhook/:id_trainer", raw({ type: "application/json" }), async (req, res) => {
	try {
		const { stripe, webhookSecret } = await getTrainerStripe(req.params.id_trainer);

		if (!webhookSecret) {
			return res.status(500).send("Webhook non configuré pour cet éducateur");
		}

		let event;
		try {
			event = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"], webhookSecret);
		} catch (err) {
			return res.status(400).send(`Signature invalide: ${err.message}`);
		}

		switch (event.type) {
			case "checkout.session.completed":
			case "checkout.session.async_payment_succeeded":
				await confirmCheckoutSession({ id_trainer: req.params.id_trainer, session: event.data.object });
				break;

			case "checkout.session.expired":
			case "checkout.session.async_payment_failed":
				// Les réservations restent actives (non payées) : on solde juste la
				// session pour que le cron arrête de la surveiller
				await markCheckoutExpired({ session_id: event.data.object.id });
				break;
		}

		res.send({ received: true });
	} catch (err) {
		errorHandler({ err, req });
		res.status(500).send("Webhook error");
	}
});

const StripeWebhook = () => router;

export { StripeWebhook };
