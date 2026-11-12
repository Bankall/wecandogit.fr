import { test } from "node:test";
import assert from "node:assert/strict";

import { wallTimeToDate, formatSlotDate, escapeIcsText, foldIcsLine, buildIcs, buildReservationEvent, buildIcsAttachment } from "../lib/calendar.js";

test("wallTimeToDate reads stored slot dates as Paris time, winter and summer", () => {
	assert.equal(wallTimeToDate("2026-01-10 14:00:00").toISOString(), "2026-01-10T13:00:00.000Z");
	assert.equal(wallTimeToDate("2026-07-10 14:00:00").toISOString(), "2026-07-10T12:00:00.000Z");
	assert.equal(wallTimeToDate("2026-07-10T09:30").toISOString(), "2026-07-10T07:30:00.000Z");
});

test("wallTimeToDate is right on both DST change days", () => {
	// Spring forward 2026-03-29 02:00 CET -> 03:00 CEST
	assert.equal(wallTimeToDate("2026-03-29 01:30:00").toISOString(), "2026-03-29T00:30:00.000Z");
	assert.equal(wallTimeToDate("2026-03-29 03:30:00").toISOString(), "2026-03-29T01:30:00.000Z");
	// Fall back 2026-10-25 03:00 CEST -> 02:00 CET
	assert.equal(wallTimeToDate("2026-10-25 01:30:00").toISOString(), "2026-10-24T23:30:00.000Z");
	assert.equal(wallTimeToDate("2026-10-25 04:00:00").toISOString(), "2026-10-25T03:00:00.000Z");
});

test("wallTimeToDate rejects what is not a date", () => {
	assert.throws(() => wallTimeToDate("demain"), /Invalid slot date/);
});

test("formatSlotDate gives the weekday and the stored wall-clock time", () => {
	assert.equal(formatSlotDate("2026-11-10 14:00:00"), "mardi 10/11 à 14h00");
	assert.equal(formatSlotDate("2026-07-05 09:30:00"), "dimanche 05/07 à 09h30");
});

test("escapeIcsText escapes the characters RFC 5545 reserves", () => {
	assert.equal(escapeIcsText("a,b;c\\d\ne"), "a\\,b\\;c\\\\d\\ne");
	assert.equal(escapeIcsText(null), "");
});

test("foldIcsLine keeps every line within 75 octets, without splitting a character", () => {
	const line = `SUMMARY:${"Éducation canine ".repeat(10)}`;
	const folded = foldIcsLine(line);
	const parts = folded.split("\r\n");

	assert.ok(parts.length > 1);
	parts.forEach(part => assert.ok(Buffer.byteLength(part) <= 75, part));
	parts.slice(1).forEach(part => assert.ok(part.startsWith(" ")));
	assert.equal(parts.map((part, index) => (index ? part.slice(1) : part)).join(""), line);
	assert.equal(foldIcsLine("SHORT:line"), "SHORT:line");
});

test("buildIcs builds a PUBLISH calendar with UTC times and CRLF line endings", () => {
	const ics = buildIcs([{ uid: "reservation-42@wecandogit.com", start: "2026-01-10 14:00:00", duration_minutes: 90, summary: "Agility, niveau 1", description: "Séance avec Rex" }], { now: new Date("2026-01-01T10:00:00Z") });

	assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n"));
	assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
	assert.ok(!/[^\r]\n/.test(ics), "only CRLF line endings");
	assert.match(ics, /METHOD:PUBLISH\r\n/);
	assert.match(ics, /UID:reservation-42@wecandogit\.com\r\n/);
	assert.match(ics, /DTSTAMP:20260101T100000Z\r\n/);
	assert.match(ics, /DTSTART:20260110T130000Z\r\n/);
	assert.match(ics, /DTEND:20260110T143000Z\r\n/);
	assert.match(ics, /SUMMARY:Agility\\, niveau 1\r\n/);
	assert.match(ics, /DESCRIPTION:Séance avec Rex\r\n/);
	assert.doesNotMatch(ics, /LOCATION:/);
});

test("buildIcs falls back to a one-hour session when the duration is unknown", () => {
	const ics = buildIcs([{ uid: "x", start: "2026-07-10 14:00:00", summary: "Balade" }]);

	assert.match(ics, /DTSTART:20260710T120000Z\r\n/);
	assert.match(ics, /DTEND:20260710T130000Z\r\n/);
});

test("buildReservationEvent gives a stable UID per reservation", () => {
	const event = buildReservationEvent({ id_reservation: 11596, activity: "Mantrailing", start: "2026-11-10 14:00:00", duration_minutes: 60, dog: "Rex" });

	assert.equal(event.uid, "reservation-11596@wecandogit.com");
	assert.equal(event.summary, "Mantrailing - We Can Dog It");
	assert.equal(event.description, "Séance avec Rex");
	assert.equal(buildReservationEvent({ id_reservation: 1, activity: "Balade", start: "2026-11-10 14:00:00" }).description, "");
});

test("buildIcsAttachment names the file after the session and its day", () => {
	const attachment = buildIcsAttachment(buildReservationEvent({ id_reservation: 7, activity: "Éducation & Jeux", start: "2026-03-05 10:00:00", duration_minutes: 60 }));

	assert.equal(attachment.filename, "education-jeux-we-can-dog-it-2026-03-05.ics");
	assert.equal(attachment.contentType, "text/calendar; charset=utf-8; method=PUBLISH");
	assert.match(attachment.content, /DTSTART:20260305T090000Z/);
});
