/*
 * Tells the members booked on a slot that its location was set or changed.
 * Triggered by a trainer editing the slot (router/Private, PUT /slot/:id), not
 * awaited there: mailing must not hold up the save.
 */
import { query } from "./db.js";
import MailSender from "./mail-sender/index.cjs";
import { buildReservationEvent, buildIcsAttachment } from "./calendar.js";
import { getLocationChange, groupReservationsByMember, buildLocationChangeMail } from "./location-change-mail.js";

/**
 * previous / location: the slot's location before and after the edit.
 * Past or deleted slots, and edits that change nothing (or clear the place), send nothing.
 */
const notifyLocationChange = async ({ id_slot, previous, location }) => {
	const change = getLocationChange(previous, location);

	if (change !== "set" && change !== "changed") {
		return { id_slot, change, notified: [] };
	}

	const rows = await query(
		`SELECT
			r.id id_reservation,
			d.label dog,
			u.id id_user,
			u.firstname,
			u.email,
			s.date,
			a.label activity,
			a.duration
		FROM reservation r
		JOIN slot s ON s.id = r.id_slot
		JOIN activity a ON a.id = s.id_activity
		JOIN dog d ON d.id = r.id_dog
		JOIN user u ON u.id = d.id_user
		WHERE r.id_slot = ? AND r.enabled = 1 AND s.enabled = 1 AND s.date > NOW()
		ORDER BY u.id, r.id`,
		[id_slot]
	);

	if (!rows.length) {
		return { id_slot, change, notified: [] };
	}

	const { date, activity, duration } = rows[0];
	const members = groupReservationsByMember(rows);
	// Same UID as the booking's entry and a newer SEQUENCE: calendars update it in place
	const sequence = Math.floor(Date.now() / 1000);
	const notified = [];

	for (const member of members) {
		try {
			const mail = buildLocationChangeMail({
				change,
				firstname: member.firstname,
				activity,
				start: date,
				dogs: member.reservations.map(reservation => reservation.dog),
				previous,
				location
			});

			await MailSender.send({
				subject: mail.subject,
				email: member.email,
				macros: {
					PRE_HEADER: mail.pre_header,
					CONTENT_HTML: mail.html,
					EMAIL_TYPE: "reminder",
					EMAIL: member.email
				},
				attachments: member.reservations.map(reservation =>
					buildIcsAttachment({
						...buildReservationEvent({ id_reservation: reservation.id_reservation, activity, start: date, duration_minutes: duration, dog: reservation.dog, location }),
						sequence
					})
				)
			});

			notified.push(member.id_user);
		} catch (err) {
			console.log(`Location-change mail failed (slot ${id_slot}, user ${member.id_user}):`, err?.message || err);
		}
	}

	return { id_slot, change, notified };
};

export { notifyLocationChange };
