/*
 * Waiting-list rules, kept free of any database or mail dependency so they can be
 * unit tested on their own. The side that applies them is lib/waiting-list.js.
 */

/** How long a member has to use a freed spot before the next person is told about it. */
const OFFER_WINDOW_MINUTES = Math.max(1, parseInt(process.env.WAITING_LIST_OFFER_MINUTES || "15", 10) || 15);

/**
 * How many more people to tell about a slot right now: one per free spot, minus
 * the offers still inside their window. With one freed spot that is one person
 * every OFFER_WINDOW_MINUTES; with two freed spots, two people at a time.
 * An offer does not hold the spot: whoever books first gets it.
 */
const countOffersToSend = ({ spots, reserved, running_offers }) => Math.max(0, (spots || 0) - (reserved || 0) - (running_offers || 0));

/**
 * The next `count` members in line, in the order given (oldest registration first).
 * A member registered twice on the same slot is told once, at their first rank.
 */
const pickNextMembers = (entries, count) => {
	const seen = new Set();
	const picked = [];

	for (const entry of entries) {
		if (picked.length >= count) {
			break;
		}

		if (seen.has(entry.id_user)) {
			continue;
		}

		seen.add(entry.id_user);
		picked.push(entry);
	}

	return picked;
};

const escapeHtml = text =>
	String(text ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");

/** Subject and body of the "a spot is free" mail. */
const buildOfferMail = ({ firstname, activity, date_label, claim_url, window_minutes = OFFER_WINDOW_MINUTES }) => ({
	subject: "Une place s'est libérée",
	pre_header: `Une place s'est libérée : ${activity} ${date_label}`,
	html: `<p>Bonjour ${escapeHtml(firstname)},</p>
			<p>Une place s'est libérée sur le créneau <b>${escapeHtml(activity)}</b> du <b>${escapeHtml(date_label)}</b>.</p>
			<p><a href="${escapeHtml(claim_url)}">Cliquez ici pour la réserver</a> si elle est toujours disponible.</p>
			<p style='font-size: 0.9em;'>La place n'est pas bloquée : elle revient à la première personne qui la réserve. Si elle est toujours libre dans ${window_minutes} minutes, la personne suivante de la liste d'attente sera prévenue à son tour.</p>
			<p>A bientôt !</p>`
});

/**
 * Lines of the /cron/process-waiting-lists report, one per slot looked at.
 * In a dry run the members are those who *would* be told, nothing was sent.
 */
const formatProcessingReport = (results, { dryRun = false } = {}) => {
	const lines = (results || []).map(result => {
		if (result.error) {
			return `Créneau ${result.id_slot} : erreur — ${result.error}`;
		}

		const slot = result.slot;
		const title = slot ? `Créneau ${result.id_slot} (${slot.label}, ${slot.date}, ${slot.reserved}/${slot.spots} réservées)` : `Créneau ${result.id_slot}`;

		if (!result.members || !result.members.length) {
			return `${title} : rien à envoyer${slot && slot.running_offers ? ` (${slot.running_offers} proposition(s) en cours)` : ""}`;
		}

		const who = result.members.map(member => `${member.firstname} #${member.id_user} <${member.email}>`).join(", ");
		return `${title} : ${dryRun ? "serait proposé à" : "proposé à"} ${who}`;
	});

	if (!lines.length) {
		lines.push("No waiting-list offer to send");
	}

	return dryRun ? ["[DRY RUN] Aucun mail envoyé, rien n'a été modifié", ...lines] : lines;
};

export { OFFER_WINDOW_MINUTES, countOffersToSend, pickNextMembers, buildOfferMail, escapeHtml, formatProcessingReport };
