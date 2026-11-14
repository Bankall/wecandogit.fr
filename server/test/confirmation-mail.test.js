import { test } from "node:test";
import assert from "node:assert/strict";

import { formatPaymentLabel, formatConfirmationLine, selectCalendarEvents, buildConfirmationMail } from "../lib/confirmation-mail.js";
import { formatSlotDateLong } from "../lib/calendar.js";

test("formatSlotDateLong spells out the day, month and year", () => {
	assert.equal(formatSlotDateLong("2026-01-11 20:00:00"), "dimanche 11 janvier 2026 à 20h00");
	assert.equal(formatSlotDateLong("2026-11-01 09:05:00"), "dimanche 1 novembre 2026 à 09h05");
});

test("formatPaymentLabel", () => {
	assert.equal(formatPaymentLabel(42), "Formule");
	assert.equal(formatPaymentLabel("direct"), "En ligne");
	assert.equal(formatPaymentLabel("later"), "En personne");
});

test("a session line has the activity, the dog, the full date, the place and the payment", () => {
	const line = formatConfirmationLine({
		payment_type: 12,
		session: { activity: "Parc en collectif", dog: "Rex", start: "2026-01-11 20:00:00", location: "We Can Dog It, Les Sables, 51370 Les Mesneux" }
	});

	assert.equal(line, "<li><b>Parc en collectif</b> avec Rex — dimanche 11 janvier 2026 à 20h00 — Lieu : We Can Dog It, Les Sables, 51370 Les Mesneux — Paiement : Formule</li>");
});

test("a session whose place is not known yet, booked without a dog name, has no Lieu nor 'avec'", () => {
	const line = formatConfirmationLine({ payment_type: "later", session: { activity: "Balade", start: "2026-07-05 09:30:00", location: null } });

	assert.equal(line, "<li><b>Balade</b> — dimanche 5 juillet 2026 à 09h30 — Paiement : En personne</li>");
});

test("a package line keeps its label", () => {
	assert.equal(formatConfirmationLine({ label: "Carte 10 séances", payment_type: "direct" }), "<li>Carte 10 séances — Paiement : En ligne</li>");
});

test("names and places are HTML-escaped", () => {
	const line = formatConfirmationLine({ payment_type: "direct", session: { activity: "Agility & Hoopers", dog: "<Rex>", start: "2026-01-11 20:00:00", location: 'Parc "Les Sables"' } });

	assert.match(line, /<b>Agility &amp; Hoopers<\/b> avec &lt;Rex&gt;/);
	assert.match(line, /Lieu : Parc &quot;Les Sables&quot;/);
});

test("selectCalendarEvents: a calendar entry per session with a known place only", () => {
	const withPlace = { uid: "reservation-1@wecandogit.com", location: "We Can Dog It, Les Sables, 51370 Les Mesneux" };
	const withoutPlace = { uid: "reservation-2@wecandogit.com", location: "" };

	assert.deepEqual(selectCalendarEvents([{ calendar_event: withPlace }, { calendar_event: withoutPlace }, { label: "Carte 10 séances" }]), [withPlace]);
	assert.deepEqual(selectCalendarEvents([]), []);
	assert.deepEqual(selectCalendarEvents(undefined), []);
});

test("buildConfirmationMail: one line per item, singular or plural, first name escaped", () => {
	const session = { payment_type: 12, session: { activity: "Balade", dog: "Rex", start: "2026-11-15 10:00:00", location: null } };
	const single = buildConfirmationMail({ firstname: "Zoé <b>", reserved: [session] });
	const several = buildConfirmationMail({ firstname: "Zoé", reserved: [session, { label: "Carte 10 séances", payment_type: "direct" }] });

	assert.equal(single.subject, "Confirmation de commande");
	assert.match(single.html, /Bonjour Zoé &lt;b&gt;,/);
	assert.match(single.html, /Nous vous confirmons votre réservation,/);
	assert.equal((several.html.match(/<li>/g) || []).length, 2);
	assert.match(several.html, /Nous vous confirmons vos réservations,/);
});
