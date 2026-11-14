import { test } from "node:test";
import assert from "node:assert/strict";

import { getLocationChange, groupReservationsByMember, buildLocationChangeMail } from "../lib/location-change-mail.js";
import { buildIcs, buildReservationEvent } from "../lib/calendar.js";

const PARK = "We Can Dog It, Les Sables, 51370 Les Mesneux";

test("getLocationChange: set, changed, cleared", () => {
	assert.equal(getLocationChange(null, PARK), "set");
	assert.equal(getLocationChange("", PARK), "set");
	assert.equal(getLocationChange(PARK, "Parc de Champagne, Reims"), "changed");
	assert.equal(getLocationChange(PARK, ""), "cleared");
	assert.equal(getLocationChange(PARK, null), "cleared");
});

test("getLocationChange: saving the same place (spaces aside) is no change", () => {
	assert.equal(getLocationChange(PARK, PARK), null);
	assert.equal(getLocationChange(PARK, `  ${PARK.replace(", ", ",   ")} `), null);
	assert.equal(getLocationChange(null, ""), null);
	assert.equal(getLocationChange(null, null), null);
});

test("groupReservationsByMember: one entry per member, all their dogs, placeholder user 2 dropped", () => {
	const members = groupReservationsByMember([
		{ id_reservation: 10, dog: "Rex", id_user: 7, firstname: "Zoé", email: "zoe@example.com" },
		{ id_reservation: 11, dog: "Pixel", id_user: 7, firstname: "Zoé", email: "zoe@example.com" },
		{ id_reservation: 12, dog: "Médor", id_user: 2, firstname: "Contact", email: "contact.wecandogit@gmail.com" },
		{ id_reservation: 13, dog: "Lune", id_user: 9, firstname: "Paul", email: "paul@example.com" },
		{ id_reservation: 14, dog: "Sans mail", id_user: 11, firstname: "X", email: "" }
	]);

	assert.deepEqual(
		members.map(member => [member.id_user, member.reservations.map(reservation => reservation.id_reservation)]),
		[
			[7, [10, 11]],
			[9, [13]]
		]
	);
	assert.deepEqual(groupReservationsByMember([]), []);
});

test("buildLocationChangeMail: a place set for the first time", () => {
	const mail = buildLocationChangeMail({ change: "set", firstname: "Zoé", activity: "Balade", start: "2026-11-15 10:00:00", dogs: ["Rex"], previous: null, location: PARK });

	assert.equal(mail.subject, "Le lieu de votre séance a été ajouté");
	assert.match(mail.html, /Un lieu a été ajouté pour votre séance <b>Balade<\/b>/);
	assert.match(mail.html, /<b>Balade<\/b> avec Rex le <b>dimanche 15 novembre 2026 à 10h00<\/b>\./);
	assert.match(mail.html, /Lieu : <b>We Can Dog It, Les Sables, 51370 Les Mesneux<\/b>/);
	assert.doesNotMatch(mail.html, /Ancien lieu/);
});

test("buildLocationChangeMail: a changed place shows the old one, several dogs, escaped", () => {
	const mail = buildLocationChangeMail({
		change: "changed",
		firstname: "Zoé",
		activity: "Agility & Hoopers",
		start: "2026-11-15 10:00:00",
		dogs: ["Rex", "Pixel", "<Lune>"],
		previous: PARK,
		location: "Parc de Champagne, Reims"
	});

	assert.equal(mail.subject, "Changement de lieu pour votre séance");
	assert.match(mail.html, /<b>Agility &amp; Hoopers<\/b> avec Rex, Pixel et &lt;Lune&gt; le/);
	assert.match(mail.html, /a changé\./);
	assert.match(mail.html, /Lieu : <b>Parc de Champagne, Reims<\/b>/);
	assert.match(mail.html, /Ancien lieu : We Can Dog It, Les Sables, 51370 Les Mesneux/);
});

test("the updated calendar entry keeps the booking's UID and carries a SEQUENCE", () => {
	const event = { ...buildReservationEvent({ id_reservation: 10, activity: "Balade", start: "2026-11-15 10:00:00", location: PARK }), sequence: 1791979488 };
	const ics = buildIcs([event]);

	assert.match(ics, /\r\nUID:reservation-10@wecandogit\.com\r\n/);
	assert.match(ics, /\r\nSEQUENCE:1791979488\r\n/);
	assert.doesNotMatch(buildIcs([buildReservationEvent({ id_reservation: 10, activity: "Balade", start: "2026-11-15 10:00:00" })]), /SEQUENCE/);
});
