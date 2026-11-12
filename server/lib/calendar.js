/*
 * Calendar invites for booked sessions (.ics files).
 *
 * Slot dates are stored as Paris wall-clock time, without a zone ("2026-11-10 14:00:00"),
 * while the database clock itself runs in UTC. Events are therefore converted from
 * Europe/Paris to UTC here, so every calendar app places them at the right hour,
 * whatever its own time zone and on both sides of a DST change.
 */

const TIME_ZONE = "Europe/Paris";
const DEFAULT_DURATION_MINUTES = 60;

const WALL_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/;

const parseWallTime = value => {
	const match = String(value).match(WALL_TIME_PATTERN);
	if (!match) {
		throw new Error(`Invalid slot date: ${value}`);
	}

	const [, year, month, day, hour, minute, second = "0"] = match;
	return { year: +year, month: +month, day: +day, hour: +hour, minute: +minute, second: +second };
};

/** Offset of `timeZone` from UTC at `instant`, in milliseconds. */
const timeZoneOffset = (instant, timeZone) => {
	const parts = Object.fromEntries(
		new Intl.DateTimeFormat("en-US", {
			timeZone,
			hourCycle: "h23",
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit"
		})
			.formatToParts(instant)
			.map(part => [part.type, part.value])
	);

	const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
	return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
};

/** "2026-11-10 14:00:00" read as wall-clock time in `timeZone` -> the matching instant. */
const wallTimeToDate = (value, timeZone = TIME_ZONE) => {
	const { year, month, day, hour, minute, second } = parseWallTime(value);
	const guess = Date.UTC(year, month - 1, day, hour, minute, second);

	// Twice: the offset at the guess can differ from the offset at the real instant
	// when the two fall on either side of a DST change
	const firstPass = guess - timeZoneOffset(new Date(guess), timeZone);
	return new Date(guess - timeZoneOffset(new Date(firstPass), timeZone));
};

/** "mardi 10/11 à 14h00", straight from the stored wall-clock time. */
const formatSlotDate = value => {
	const { year, month, day, hour, minute } = parseWallTime(value);
	const weekday = new Intl.DateTimeFormat("fr-FR", { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day)));
	const pad = number => String(number).padStart(2, "0");

	return `${weekday} ${pad(day)}/${pad(month)} à ${pad(hour)}h${pad(minute)}`;
};

/** "dimanche 11 janvier 2026 à 20h00", straight from the stored wall-clock time. */
const formatSlotDateLong = value => {
	const { year, month, day, hour, minute } = parseWallTime(value);
	const date = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day)));
	const pad = number => String(number).padStart(2, "0");

	return `${date} à ${pad(hour)}h${pad(minute)}`;
};

const formatIcsDate = date => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

const escapeIcsText = text =>
	String(text ?? "")
		.replace(/\\/g, "\\\\")
		.replace(/;/g, "\\;")
		.replace(/,/g, "\\,")
		.replace(/\r?\n/g, "\\n");

/** RFC 5545: content lines are folded at 75 octets, continuation lines start with a space. */
const foldIcsLine = line => {
	const folded = [];
	let current = "";
	let size = 0;
	let limit = 75;

	for (const character of line) {
		const characterSize = Buffer.byteLength(character);

		if (size + characterSize > limit) {
			folded.push(current);
			current = " ";
			size = 1;
		}

		current += character;
		size += characterSize;
	}

	folded.push(current);
	return folded.join("\r\n");
};

const getEventBounds = event => {
	const start = wallTimeToDate(event.start);
	const end = new Date(start.getTime() + (event.duration_minutes || DEFAULT_DURATION_MINUTES) * 60 * 1000);

	return { start, end };
};

/**
 * One VCALENDAR holding `events`. METHOD:PUBLISH (not REQUEST): this is a
 * calendar entry to add, not a meeting invitation expecting an RSVP.
 *
 * event: { uid, start (stored wall-clock date), duration_minutes, summary, description?, location?, url?, sequence? }
 * sequence: revision number of an entry already sent (same uid); calendars keep the highest.
 */
const buildIcs = (events, { now = new Date() } = {}) => {
	const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//We Can Dog It//Reservations//FR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];

	for (const event of events) {
		const { start, end } = getEventBounds(event);

		lines.push("BEGIN:VEVENT", `UID:${event.uid}`, `DTSTAMP:${formatIcsDate(now)}`, `DTSTART:${formatIcsDate(start)}`, `DTEND:${formatIcsDate(end)}`, `SUMMARY:${escapeIcsText(event.summary)}`);

		if (Number.isInteger(event.sequence) && event.sequence > 0) {
			lines.push(`SEQUENCE:${event.sequence}`);
		}

		if (event.description) {
			lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
		}

		if (event.location) {
			lines.push(`LOCATION:${escapeIcsText(event.location)}`);
		}

		if (event.url) {
			lines.push(`URL:${event.url}`);
		}

		lines.push("END:VEVENT");
	}

	lines.push("END:VCALENDAR");
	return lines.map(foldIcsLine).join("\r\n") + "\r\n";
};

/** The calendar event of a booked session. Stable UID: importing it twice updates it instead of duplicating it. */
const buildReservationEvent = ({ id_reservation, activity, start, duration_minutes, dog, location }) => ({
	uid: `reservation-${id_reservation}@wecandogit.com`,
	start,
	duration_minutes,
	summary: `${activity} - We Can Dog It`,
	description: dog ? `Séance avec ${dog}` : "",
	// Slots whose location is not known yet have none: the event simply carries no place
	location: location || ""
});

/** Nodemailer attachment for one event, named after the session so several stay tellable apart. */
const buildIcsAttachment = (event, { now } = {}) => {
	const { year, month, day } = parseWallTime(event.start);
	const slug = String(event.summary)
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-zA-Z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
		.toLowerCase();

	return {
		filename: `${slug}-${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}.ics`,
		content: buildIcs([event], { now }),
		contentType: "text/calendar; charset=utf-8; method=PUBLISH"
	};
};

export { wallTimeToDate, formatSlotDate, formatSlotDateLong, escapeIcsText, foldIcsLine, buildIcs, buildReservationEvent, buildIcsAttachment, TIME_ZONE };
