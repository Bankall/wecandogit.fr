/*
 * "The place of your session has been set / has changed" mail. Pure (no database,
 * no mail) so it can be unit tested; lib/location-change.js sends it.
 */
import { normalizeSlotLocation } from "./slot-location.js";
import { formatSlotDateLong } from "./calendar.js";
import { escapeHtml } from "./waiting-list-rules.js";

/**
 * What a location edit amounts to: "set" (there was none), "changed", "cleared",
 * or null when the place is the same once normalised (a form saved unchanged, extra
 * spaces…). Only "set" and "changed" are worth telling members about.
 */
const getLocationChange = (previous, next) => {
	const before = normalizeSlotLocation(previous);
	const after = normalizeSlotLocation(next);

	if (before === after) {
		return null;
	}

	if (!after) {
		return "cleared";
	}

	return before ? "changed" : "set";
};

/**
 * Active reservations of a slot, one row per dog -> one entry per member.
 * Rows of the placeholder owner of trainer-registered dogs (EXCLUDED_USER_IDS) are dropped.
 */
const EXCLUDED_USER_IDS = new Set([2]);

const groupReservationsByMember = rows => {
	const members = new Map();

	for (const row of rows || []) {
		if (EXCLUDED_USER_IDS.has(row.id_user) || !row.email) {
			continue;
		}

		if (!members.has(row.id_user)) {
			members.set(row.id_user, { id_user: row.id_user, firstname: row.firstname, email: row.email, reservations: [] });
		}

		members.get(row.id_user).reservations.push({ id_reservation: row.id_reservation, dog: row.dog });
	}

	return [...members.values()];
};

const formatDogs = dogs => {
	const names = dogs.filter(Boolean);

	if (names.length <= 1) {
		return names[0] || "";
	}

	return `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}`;
};

/** Subject and body for one member. change: "set" | "changed". */
const buildLocationChangeMail = ({ change, firstname, activity, start, dogs = [], previous, location }) => {
	const dogNames = formatDogs(dogs);
	const session = `<b>${escapeHtml(activity)}</b>${dogNames ? ` avec ${escapeHtml(dogNames)}` : ""} le <b>${escapeHtml(formatSlotDateLong(start))}</b>`;
	const changed = change === "changed";

	return {
		subject: changed ? "Changement de lieu pour votre séance" : "Le lieu de votre séance a été ajouté",
		pre_header: `${activity} : ${location}`,
		html: `<p>Bonjour ${escapeHtml(firstname)},</p>
			<p>${changed ? "Le lieu de votre séance" : "Un lieu a été ajouté pour votre séance"} ${session}${changed ? " a changé." : "."}</p>
			<p>Lieu : <b>${escapeHtml(location)}</b></p>
			${changed && previous ? `<p style='color: #6C6967;'>Ancien lieu : ${escapeHtml(previous)}</p>` : ""}
			<p>A bientôt !</p>`
	};
};

export { getLocationChange, groupReservationsByMember, buildLocationChangeMail, EXCLUDED_USER_IDS };
