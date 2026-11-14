import { test } from "node:test";
import assert from "node:assert/strict";

import { OFFER_WINDOW_MINUTES, countOffersToSend, pickNextMembers, buildOfferMail, formatProcessingReport } from "../lib/waiting-list-rules.js";

test("the offer window defaults to 15 minutes", () => {
	assert.equal(OFFER_WINDOW_MINUTES, 15);
});

test("countOffersToSend: one offer per free spot, minus the offers still running", () => {
	assert.equal(countOffersToSend({ spots: 6, reserved: 5, running_offers: 0 }), 1);
	assert.equal(countOffersToSend({ spots: 6, reserved: 5, running_offers: 1 }), 0);
	assert.equal(countOffersToSend({ spots: 6, reserved: 4, running_offers: 1 }), 1);
	assert.equal(countOffersToSend({ spots: 6, reserved: 4, running_offers: 0 }), 2);
});

test("countOffersToSend never goes negative (full slot, or more offers than spots)", () => {
	assert.equal(countOffersToSend({ spots: 6, reserved: 6, running_offers: 0 }), 0);
	assert.equal(countOffersToSend({ spots: 6, reserved: 7, running_offers: 0 }), 0);
	assert.equal(countOffersToSend({ spots: 1, reserved: 0, running_offers: 3 }), 0);
	assert.equal(countOffersToSend({}), 0);
});

test("pickNextMembers keeps the order and tells a member registered twice only once", () => {
	const entries = [
		{ id: 10, id_user: 1 },
		{ id: 11, id_user: 2 },
		{ id: 12, id_user: 1 },
		{ id: 13, id_user: 3 }
	];

	assert.deepEqual(
		pickNextMembers(entries, 1).map(entry => entry.id),
		[10]
	);
	assert.deepEqual(
		pickNextMembers(entries, 3).map(entry => entry.id),
		[10, 11, 13]
	);
	assert.deepEqual(
		pickNextMembers(entries, 10).map(entry => entry.id),
		[10, 11, 13]
	);
	assert.deepEqual(pickNextMembers(entries, 0), []);
	assert.deepEqual(pickNextMembers([], 2), []);
});

test("buildOfferMail names the slot, links to the claim page and escapes user data", () => {
	const mail = buildOfferMail({
		firstname: "Zoé <script>",
		activity: "Agility & Hoopers",
		date_label: "mardi 10/11 à 14h00",
		claim_url: "https://wecandogit.com/cart/liste-attente/1178",
		window_minutes: 15
	});

	assert.equal(mail.subject, "Une place s'est libérée");
	assert.match(mail.html, /Zoé &lt;script&gt;/);
	assert.match(mail.html, /<b>Agility &amp; Hoopers<\/b> du <b>mardi 10\/11 à 14h00<\/b>/);
	assert.match(mail.html, /<a href="https:\/\/wecandogit\.com\/cart\/liste-attente\/1178">Cliquez ici pour la réserver<\/a> si elle est toujours disponible/);
	assert.match(mail.html, /dans 15 minutes/);
	assert.match(mail.pre_header, /Agility & Hoopers mardi 10\/11 à 14h00/);
});

const SLOT_RESULT = {
	id_slot: 15461,
	slot: { label: "Agility", date: "2026-11-13 14:00:00", spots: 2, reserved: 1, running_offers: 0 },
	members: [{ id_user: 1709, firstname: "Océane", email: "oceane@example.com" }],
	offered: [1709]
};

test("formatProcessingReport: a real run says who was told", () => {
	assert.deepEqual(formatProcessingReport([SLOT_RESULT]), ["Créneau 15461 (Agility, 2026-11-13 14:00:00, 1/2 réservées) : proposé à Océane #1709 <oceane@example.com>"]);
});

test("formatProcessingReport: a dry run is flagged and says who would be told", () => {
	const lines = formatProcessingReport([SLOT_RESULT], { dryRun: true });

	assert.equal(lines[0], "[DRY RUN] Aucun mail envoyé, rien n'a été modifié");
	assert.match(lines[1], /: serait proposé à Océane #1709 <oceane@example\.com>$/);
});

test("formatProcessingReport: explains a slot with nothing to send, and errors", () => {
	const waiting = { id_slot: 2, slot: { label: "Balade", date: "2026-11-14 10:00:00", spots: 6, reserved: 5, running_offers: 1 }, members: [], offered: [] };
	const failed = { id_slot: 3, error: "Lock wait timeout" };

	assert.deepEqual(formatProcessingReport([waiting, failed]), ["Créneau 2 (Balade, 2026-11-14 10:00:00, 5/6 réservées) : rien à envoyer (1 proposition(s) en cours)", "Créneau 3 : erreur — Lock wait timeout"]);
});

test("formatProcessingReport: nothing to process", () => {
	assert.deepEqual(formatProcessingReport([]), ["No waiting-list offer to send"]);
	assert.deepEqual(formatProcessingReport([], { dryRun: true }), ["[DRY RUN] Aucun mail envoyé, rien n'a été modifié", "No waiting-list offer to send"]);
});
