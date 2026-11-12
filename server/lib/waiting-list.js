/*
 * Waiting list: telling members, in turn, that a spot freed up on a full slot.
 *
 * Nothing is scheduled in memory (the API runs as several pm2 processes and
 * restarts at will): the state lives in `waiting_list` itself.
 *   - proposed = 0  -> still in line
 *   - proposed = 1  -> told at `proposed_at`, and off the list from then on
 * A slot with a free spot and people still in line gets one offer per free spot;
 * an offer "runs" for OFFER_WINDOW_MINUTES, after which, if the spot is still free,
 * the next person is told. An offer never holds the spot: first to book wins.
 *
 * Triggers: a cancellation (immediate, fire-and-forget) and the
 * /cron/process-waiting-lists route (the follow-ups every OFFER_WINDOW_MINUTES,
 * plus spots freed any other way, such as a trainer raising an activity's capacity).
 */
import config from "config";
import { query, withTransaction } from "./db.js";
import MailSender from "./mail-sender/index.cjs";
import { formatSlotDate } from "./calendar.js";
import { slotIsPublicCondition } from "./slot-visibility.js";
import { OFFER_WINDOW_MINUTES, countOffersToSend, pickNextMembers, buildOfferMail } from "./waiting-list-rules.js";

const buildClaimUrl = id_waiting_list => `${config.get("FRONT_URI")}/cart/liste-attente/${id_waiting_list}`;

const sendOffer = async ({ slot, member }) => {
	const mail = buildOfferMail({
		firstname: member.firstname,
		activity: slot.label,
		date_label: formatSlotDate(slot.date),
		claim_url: buildClaimUrl(member.id)
	});

	await MailSender.send({
		subject: mail.subject,
		email: member.email,
		macros: {
			PRE_HEADER: mail.pre_header,
			CONTENT_HTML: mail.html,
			EMAIL_TYPE: "reminder",
			EMAIL: member.email
		}
	});
};

/**
 * Tells the next people in line about a slot's free spots, if it has any.
 * The slot row is locked while deciding, so two processes (cron + cancellation)
 * never both offer the same spot.
 *
 * dryRun: same decision, but nothing is written, no mail is sent and no row is
 * locked; the result says who would have been told.
 */
const offerFreedSpots = async (id_slot, { dryRun = false } = {}) => {
	// A slot hidden from the agenda is offered to nobody
	const isPublic = await slotIsPublicCondition();

	const { slot, members } = await withTransaction(async connection => {
		const slots = await query(
			`SELECT
				s.id,
				s.date,
				a.label,
				a.spots,
				(SELECT COUNT(*) FROM reservation r WHERE r.id_slot = s.id AND r.enabled = 1) reserved,
				(SELECT COUNT(DISTINCT wl.id_user) FROM waiting_list wl WHERE wl.id_slot = s.id AND wl.proposed = 1 AND wl.proposed_at > NOW() - INTERVAL ? MINUTE) running_offers
			FROM slot s
			JOIN activity a ON a.id = s.id_activity
			WHERE s.id = ? AND s.enabled = 1 AND s.date > NOW() AND ${isPublic}
			${dryRun ? "" : "FOR UPDATE"}`,
			[OFFER_WINDOW_MINUTES, id_slot],
			connection
		);

		const slot = slots[0];
		const count = slot ? countOffersToSend(slot) : 0;

		if (!count) {
			return { slot, members: [] };
		}

		const entries = await query(
			`SELECT wl.id, wl.id_user, u.email, u.firstname
			FROM waiting_list wl
			JOIN user u ON u.id = wl.id_user
			WHERE wl.id_slot = ? AND wl.proposed = 0 AND wl.declined = 0
			ORDER BY wl.date ASC, wl.id ASC`,
			[id_slot],
			connection
		);

		const members = pickNextMembers(entries, count);

		if (dryRun) {
			return { slot, members };
		}

		// Every entry of that member on the slot: someone registered twice is told once
		for (const member of members) {
			await query("UPDATE waiting_list SET proposed = 1, proposed_at = NOW() WHERE id_slot = ? AND id_user = ? AND proposed = 0 AND declined = 0", [id_slot, member.id_user], connection);
		}

		return { slot, members };
	});

	// Mails go out after the commit. A failed mail is not retried: the member is off
	// the list already, and the next one is told when the window runs out.
	if (!dryRun) {
		for (const member of members) {
			try {
				await sendOffer({ slot, member });
			} catch (err) {
				console.log(`Waiting-list mail failed (slot ${id_slot}, user ${member.id_user}):`, err?.message || err);
			}
		}
	}

	return {
		id_slot,
		dry_run: dryRun,
		offered: members.map(member => member.id_user),
		// Details for the cron report (who, and why not more)
		slot: slot ? { label: slot.label, date: slot.date, spots: slot.spots, reserved: slot.reserved, running_offers: slot.running_offers } : null,
		members: members.map(member => ({ id_user: member.id_user, firstname: member.firstname, email: member.email }))
	};
};

/** Every upcoming slot with a free spot and people still in line. dryRun: see offerFreedSpots. */
const processWaitingLists = async ({ dryRun = false } = {}) => {
	const slots = await query(
		`SELECT s.id
		FROM slot s
		JOIN activity a ON a.id = s.id_activity
		WHERE s.enabled = 1
		AND s.date > NOW()
		AND ${await slotIsPublicCondition()}
		AND EXISTS (SELECT 1 FROM waiting_list wl WHERE wl.id_slot = s.id AND wl.proposed = 0 AND wl.declined = 0)
		AND (SELECT COUNT(*) FROM reservation r WHERE r.id_slot = s.id AND r.enabled = 1) < a.spots`
	);

	const results = [];
	for (const slot of slots) {
		try {
			results.push(await offerFreedSpots(slot.id, { dryRun }));
		} catch (err) {
			console.log(`Waiting-list processing failed for slot ${slot.id}:`, err?.message || err);
			results.push({ id_slot: slot.id, error: err?.message || String(err) });
		}
	}

	return results;
};

/**
 * What the link in an offer mail points at, and whether it can still be booked.
 * Returns { notFound } | { unavailable, entry } | { full, entry } | { entry }.
 */
const getClaimableSlot = async id_waiting_list => {
	const rows = await query(
		`SELECT
			wl.id,
			wl.id_slot,
			wl.id_user,
			s.date,
			a.label,
			a.spots,
			(s.enabled = 1 AND s.date > NOW() AND ${await slotIsPublicCondition()}) bookable,
			(SELECT COUNT(*) FROM reservation r WHERE r.id_slot = s.id AND r.enabled = 1) reserved
		FROM waiting_list wl
		JOIN slot s ON s.id = wl.id_slot
		JOIN activity a ON a.id = s.id_activity
		WHERE wl.id = ?`,
		[id_waiting_list]
	);

	const entry = rows[0];
	if (!entry) {
		return { notFound: true };
	}

	if (!entry.bookable) {
		return { unavailable: true, entry };
	}

	if (entry.reserved >= entry.spots) {
		return { full: true, entry };
	}

	return { entry };
};

export { offerFreedSpots, processWaitingLists, getClaimableSlot, buildClaimUrl };
