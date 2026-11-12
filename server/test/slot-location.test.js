import { test } from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_SLOT_LOCATION, normalizeSlotLocation } from "../lib/slot-location.js";
import { buildIcs, buildReservationEvent } from "../lib/calendar.js";

test("the default location is the association's park", () => {
	assert.equal(DEFAULT_SLOT_LOCATION, "We Can Dog It, Les Sables, 51370 Les Mesneux");
});

test("normalizeSlotLocation: an emptied field means 'not known yet' (null)", () => {
	assert.equal(normalizeSlotLocation(""), null);
	assert.equal(normalizeSlotLocation("   "), null);
	assert.equal(normalizeSlotLocation(null), null);
	assert.equal(normalizeSlotLocation(undefined), null);
	assert.equal(normalizeSlotLocation(42), null);
});

test("normalizeSlotLocation trims, collapses spaces and caps the length", () => {
	assert.equal(normalizeSlotLocation("  Parc   de la Patte d'Oie,\n Reims "), "Parc de la Patte d'Oie, Reims");
	assert.equal(normalizeSlotLocation("x".repeat(300)).length, 255);
});

test("a session's calendar entry carries the slot location", () => {
	const event = buildReservationEvent({ id_reservation: 3, activity: "Balade", start: "2026-11-10 14:00:00", duration_minutes: 60, location: DEFAULT_SLOT_LOCATION });

	assert.match(buildIcs([event]), /\r\nLOCATION:We Can Dog It\\, Les Sables\\, 51370 Les Mesneux\r\n/);
});

test("a slot whose location is not known yet gives an entry without a place", () => {
	const event = buildReservationEvent({ id_reservation: 4, activity: "Balade", start: "2026-11-10 14:00:00", location: null });

	assert.doesNotMatch(buildIcs([event]), /LOCATION:/);
});
