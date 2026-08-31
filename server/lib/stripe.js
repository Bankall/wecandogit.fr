import { Stripe } from "stripe";
import { query } from "./db.js";

const clients = new Map();

const getTrainerStripe = async id_trainer => {
	const rows = await query("SELECT * FROM user WHERE id = ? AND is_trainer = 1", [id_trainer]);
	const trainer = rows[0];

	if (!trainer || !trainer.stripe_sk) {
		throw new Error("Paiement non configuré");
	}

	if (!clients.has(trainer.stripe_sk)) {
		clients.set(trainer.stripe_sk, new Stripe(trainer.stripe_sk));
	}

	return {
		stripe: clients.get(trainer.stripe_sk),
		// stripe_whsec is a new, optional column: webhooks stay disabled for a trainer until it is set
		webhookSecret: trainer.stripe_whsec || null,
		vatApplicable: !!trainer.vat_applicable
	};
};

export { getTrainerStripe };
