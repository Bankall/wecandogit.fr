import { query, withTransaction } from "./db.js";
import { getTrainerStripe } from "./stripe.js";

const CANCELLATION_CUTOFF_HOURS = parseInt(process.env.CANCELLATION_CUTOFF_HOURS || "24", 10);

const isPackagePayment = payment_type => /^\d+$/.test(String(payment_type));

/**
 * Décrémente atomiquement le crédit restant d'une formule.
 * Retourne la nouvelle utilisation, ou false si plus aucun crédit disponible.
 */
const consumePackageCredit = async (id_user_package, connection) => {
	const result = await query(
		`UPDATE user_package up
		JOIN package p ON p.id = up.id_package
		SET up.usage = up.usage + 1
		WHERE up.id = ? AND up.usage < p.number_of_session`,
		[id_user_package],
		connection
	);

	if (!result.affectedRows) {
		return false;
	}

	const rows = await query("SELECT up.usage FROM user_package up WHERE up.id = ?", [id_user_package], connection);
	return rows[0].usage;
};

/**
 * Rend un crédit de formule. Ne descend jamais sous zéro (protège d'une double annulation).
 * Retourne la nouvelle utilisation ou null si rien n'a été rendu.
 */
const restorePackageCredit = async (id_user_package, connection) => {
	const result = await query("UPDATE user_package up SET up.usage = up.usage - 1 WHERE up.id = ? AND up.usage > 0", [id_user_package], connection);

	if (!result.affectedRows) {
		return null;
	}

	const rows = await query("SELECT up.usage FROM user_package up WHERE up.id = ?", [id_user_package], connection);
	return rows[0].usage;
};

/**
 * Réserve un créneau de façon transactionnelle :
 * - verrouille le créneau (FOR UPDATE) pour sérialiser les réservations concurrentes
 * - vérifie la capacité et les doublons
 * - consomme atomiquement un crédit de formule ; s'il n'en reste plus, la réservation
 *   est conservée mais bascule en paiement "sur place" (later) au lieu d'échouer
 *
 * payment_type: "direct" | "later" | id de user_package (number ou string numérique)
 */
const reserveSlot = ({ id_slot, id_dog, payment_type, payment_details = null }) => {
	return withTransaction(async connection => {
		const slots = await query(
			`SELECT
				s.id,
				s.date,
				s.id_trainer,
				a.spots,
				a.price,
				a.label,
				(SELECT COUNT(*) FROM reservation r WHERE r.id_slot = s.id AND r.enabled = 1) reserved
			FROM slot s
			JOIN activity a ON a.id = s.id_activity
			WHERE s.id = ? AND s.enabled = 1
			FOR UPDATE`,
			[id_slot],
			connection
		);

		const slot = slots[0];
		if (!slot) {
			return { unavailable: true };
		}

		if (slot.reserved >= slot.spots) {
			return { full: true, slot };
		}

		const duplicates = await query("SELECT id FROM reservation WHERE id_slot = ? AND id_dog = ? AND enabled = 1", [id_slot, id_dog], connection);
		if (duplicates.length) {
			return { duplicate: true, slot };
		}

		let finalPaymentType = isPackagePayment(payment_type) ? parseInt(payment_type, 10) : payment_type;
		let package_usage = null;
		let downgraded = false;

		if (typeof finalPaymentType === "number") {
			package_usage = await consumePackageCredit(finalPaymentType, connection);

			if (package_usage === false) {
				downgraded = true;
				package_usage = null;
				finalPaymentType = "later";
			}
		}

		const paidByPackage = typeof finalPaymentType === "number";
		const result = await query(
			"INSERT INTO reservation (id_slot, id_dog, paid, payment_type, payment_details) VALUES (?, ?, ?, ?, ?)",
			[id_slot, id_dog, paidByPackage ? 1 : 0, paidByPackage ? "package" : finalPaymentType, paidByPackage ? finalPaymentType : payment_details],
			connection
		);

		return {
			id_reservation: result.insertId,
			payment_type: finalPaymentType,
			package_usage,
			downgraded,
			slot
		};
	});
};

/**
 * Enregistre une ligne dans l'historique de paiement (remboursements inclus, en montant négatif).
 * Seules les colonnes réellement présentes dans la table sont insérées.
 */
let paymentHistoryColumns = null;
const recordPaymentHistory = async ({ session_id, payment_intent = null, amount, id_user, id_trainer, status, details }) => {
	if (!paymentHistoryColumns) {
		const columns = await query("SHOW COLUMNS FROM payment_history");
		paymentHistoryColumns = new Set(columns.map(column => column.Field));
	}

	const row = { session_id, payment_intent, amount, id_user, id_trainer, status, details: JSON.stringify(details) };
	const keys = Object.keys(row).filter(key => paymentHistoryColumns.has(key));

	await query(`INSERT INTO payment_history (${keys.map(key => `\`${key}\``).join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`, keys.map(key => row[key]));
};

/**
 * Rembourse (partiellement) la session Stripe d'origine, à hauteur du prix de la séance annulée.
 * N'interrompt jamais l'annulation : en cas d'échec Stripe, l'échec est tracé dans payment_history
 * pour que l'éducateur puisse rembourser manuellement.
 */
const refundStripePayment = async ({ id_trainer, session_id, amount, id_user, label }) => {
	try {
		const { stripe } = await getTrainerStripe(id_trainer);
		const session = await stripe.checkout.sessions.retrieve(session_id);

		if (!session.payment_intent || session.payment_status !== "paid") {
			return { ok: false, reason: "not-paid" };
		}

		const refund = await stripe.refunds.create({
			payment_intent: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent.id,
			amount
		});

		await recordPaymentHistory({
			session_id,
			payment_intent: refund.payment_intent,
			amount: -amount,
			id_user,
			id_trainer,
			status: "refunded",
			details: [{ type: "refund", label, refund_id: refund.id }]
		});

		return { ok: true, refund_id: refund.id };
	} catch (err) {
		console.log(`Stripe refund failed for session ${session_id}:`, err.message);

		await recordPaymentHistory({
			session_id,
			amount: -amount,
			id_user,
			id_trainer,
			status: "refund_failed",
			details: [{ type: "refund", label, error: err.message }]
		}).catch(() => {});

		return { ok: false, reason: err.message };
	}
};

/**
 * Annule une réservation de façon idempotente :
 * - la désactivation est atomique (une double annulation ne rembourse qu'une fois)
 * - paiement par formule -> le crédit est rendu
 * - paiement Stripe -> remboursement automatique (toujours si annulée par l'éducateur,
 *   sinon uniquement en dehors du délai d'annulation)
 */
const cancelReservation = async ({ id_reservation, byTrainer = false }) => {
	const outcome = await withTransaction(async connection => {
		const rows = await query(
			`SELECT
				r.id,
				r.paid,
				r.payment_type,
				r.payment_details,
				r.id_dog,
				r.id_slot,
				s.date slot_date,
				s.id_trainer,
				a.price,
				a.label,
				d.id_user
			FROM reservation r
			JOIN slot s ON s.id = r.id_slot
			JOIN activity a ON a.id = s.id_activity
			JOIN dog d ON d.id = r.id_dog
			WHERE r.id = ?`,
			[id_reservation],
			connection
		);

		const reservation = rows[0];
		if (!reservation) {
			return { notFound: true };
		}

		const disabled = await query("UPDATE reservation SET enabled = 0 WHERE id = ? AND enabled = 1", [id_reservation], connection);
		if (!disabled.affectedRows) {
			return { alreadyCancelled: true, reservation };
		}

		let package_usage = null;
		if (reservation.paid === 1 && reservation.payment_type === "package") {
			package_usage = await restorePackageCredit(reservation.payment_details, connection);
		}

		return { reservation, package_usage };
	});

	if (outcome.notFound || outcome.alreadyCancelled) {
		return outcome;
	}

	const { reservation } = outcome;
	const paidThroughStripe = reservation.paid === 1 && reservation.payment_type === "direct" && String(reservation.payment_details || "").startsWith("cs_");

	if (paidThroughStripe) {
		const cutoff = new Date(Date.now() + CANCELLATION_CUTOFF_HOURS * 60 * 60 * 1000);
		const refundable = byTrainer || new Date(reservation.slot_date) > cutoff;

		if (refundable) {
			outcome.refund = await refundStripePayment({
				id_trainer: reservation.id_trainer,
				session_id: reservation.payment_details,
				amount: Math.round(reservation.price * 100),
				id_user: reservation.id_user,
				label: reservation.label
			});
		} else {
			outcome.refund = { ok: false, reason: "cutoff" };
		}
	}

	return outcome;
};

/**
 * Marque comme payés les éléments couverts par une session Checkout réglée.
 * Idempotent : rejouable par le webhook, l'URL de retour et le cron sans double effet.
 */
const confirmCheckoutSession = async ({ id_trainer, session }) => {
	if (session.payment_status !== "paid") {
		return { confirmed: false };
	}

	const activities = await query("SELECT * FROM payment_activity WHERE session_id = ?", [session.id]);
	const activity = activities[0];
	const items = activity && activity.details ? JSON.parse(activity.details) : [];

	for (const item of items) {
		if (item.type === "slot" && item.reservation_id) {
			await query("UPDATE reservation SET paid = 1, payment_details = ? WHERE id = ?", [session.id, item.reservation_id]);
		}

		if (item.type === "package" && item.package_id) {
			await query("UPDATE user_package SET paid = 1, payment_details = ? WHERE id = ?", [session.id, item.package_id]);
		}
	}

	const existing = await query("SELECT id FROM payment_history WHERE session_id = ? AND amount >= 0", [session.id]);
	if (!existing.length && activity) {
		await recordPaymentHistory({
			session_id: session.id,
			payment_intent: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id,
			amount: session.amount_total,
			id_user: activity.id_user,
			id_trainer,
			status: session.status,
			details: items
		});
	}

	return { confirmed: true, items, id_user: activity ? activity.id_user : null };
};

/**
 * Solde une session Checkout expirée (ou dont le paiement a échoué), côté
 * comptabilité uniquement : les réservations restent actives en statut
 * "non payé" — l'utilisateur garde sa place et peut régler plus tard depuis
 * son compte (bouton "Régler" -> nouvelle session via /cart/pay-reservation).
 * La ligne payment_history terminale sort la session de la file du cron.
 */
const markCheckoutExpired = async ({ session_id }) => {
	const existing = await query("SELECT id FROM payment_history WHERE session_id = ?", [session_id]);
	if (existing.length) {
		return { alreadySettled: true };
	}

	const activities = await query("SELECT * FROM payment_activity WHERE session_id = ?", [session_id]);
	const activity = activities[0];

	// Session inconnue de chez nous (pas de payment_activity) : rien à solder,
	// et payment_history exige un id_user
	if (!activity) {
		return { skipped: true };
	}

	await recordPaymentHistory({
		session_id,
		amount: 0,
		id_user: activity.id_user,
		id_trainer: activity.id_trainer,
		status: "expired",
		details: []
	});

	return { settled: true };
};

export { reserveSlot, cancelReservation, consumePackageCredit, restorePackageCredit, confirmCheckoutSession, markCheckoutExpired, refundStripePayment, isPackagePayment, CANCELLATION_CUTOFF_HOURS };
