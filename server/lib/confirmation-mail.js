/*
 * Lines of the booking confirmation mail. Pure (no database, no mail) so they can be
 * unit tested; the mail itself is sent from router/Cart (handleReservation).
 */
import { formatSlotDateLong } from "./calendar.js";
import { escapeHtml } from "./waiting-list-rules.js";

/** How a booked item is paid, as the member reads it. */
const formatPaymentLabel = payment_type => {
	if (typeof payment_type === "number") {
		return "Formule";
	}

	return payment_type === "direct" ? "En ligne" : "En personne";
};

/**
 * One <li> per booked item.
 * A session: "<b>Parc en collectif</b> avec Rex — dimanche 11 janvier 2026 à 20h00 — Lieu : … — Paiement : Formule"
 * (no "Lieu" while the slot's location is not known). A package keeps its label.
 */
const formatConfirmationLine = item => {
	const payment = `Paiement : ${formatPaymentLabel(item.payment_type)}`;
	const session = item.session;

	if (!session) {
		return `<li>${escapeHtml(item.label)} — ${payment}</li>`;
	}

	const parts = [`<b>${escapeHtml(session.activity)}</b>${session.dog ? ` avec ${escapeHtml(session.dog)}` : ""}`, formatSlotDateLong(session.start)];

	if (session.location) {
		parts.push(`Lieu : ${escapeHtml(session.location)}`);
	}

	parts.push(payment);
	return `<li>${parts.join(" — ")}</li>`;
};

/**
 * The calendar entries to attach: one per booked session, except those whose place
 * is not known yet. Their entry comes with the "lieu ajouté" mail instead, so
 * the calendar does not end up with two of it.
 */
const selectCalendarEvents = reserved => (reserved || []).map(item => item.calendar_event).filter(event => event && event.location);

/** Subject and body of the booking confirmation, for `reserved` (sessions and packages). */
const buildConfirmationMail = ({ firstname, reserved }) => ({
	subject: "Confirmation de commande",
	pre_header: "C'est reservé !",
	html: `<p>Bonjour ${escapeHtml(firstname)},</p>
			<p>Nous vous confirmons ${reserved.length > 1 ? "vos réservations" : "votre réservation"}, voici le détail:</p>
			<p>
				<ul>
					${reserved.map(formatConfirmationLine).join("")}
				</ul>
			</p>
			<p></p>
			<p>A bientôt !</p>
			<br/><br/>
			<p style='color: #ED4337;'>Attention, pour tout créneau au parc de loisirs, merci de laisser vos chiens patienter dans votre voiture jusqu'à ce que l'on vienne vous chercher pour votre activité, et de ne pas les promener sur le parking ni à proximité du jardin de nos voisins.</p>`
});

export { formatPaymentLabel, formatConfirmationLine, selectCalendarEvents, buildConfirmationMail };
