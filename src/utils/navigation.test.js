import { test } from "node:test";
import assert from "node:assert/strict";

import { getNavigationLink } from "./navigation.js";

const ADDRESS = "We Can Dog It, Les Sables, 51370 Les Mesneux";
const ENCODED = encodeURIComponent(ADDRESS);

test("iPhone opens Apple Maps directions", () => {
	const link = getNavigationLink(ADDRESS, { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", maxTouchPoints: 5 });

	assert.deepEqual(link, { href: `https://maps.apple.com/?daddr=${ENCODED}&dirflg=d`, newTab: false });
});

test("iPad, which reports itself as a Mac, opens Apple Maps too", () => {
	const link = getNavigationLink(ADDRESS, { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", maxTouchPoints: 5 });

	assert.match(link.href, /^https:\/\/maps\.apple\.com\//);
});

test("Android gets a geo: link so the phone picks the user's navigation app", () => {
	const link = getNavigationLink(ADDRESS, { userAgent: "Mozilla/5.0 (Linux; Android 15; Pixel 9)", maxTouchPoints: 5 });

	assert.deepEqual(link, { href: `geo:0,0?q=${ENCODED}`, newTab: false });
});

test("desktop (a real Mac included) opens Google Maps directions in a new tab", () => {
	const expected = { href: `https://www.google.com/maps/dir/?api=1&destination=${ENCODED}`, newTab: true };

	assert.deepEqual(getNavigationLink(ADDRESS, { userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", maxTouchPoints: 0 }), expected);
	assert.deepEqual(getNavigationLink(ADDRESS, { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", maxTouchPoints: 0 }), expected);
	assert.deepEqual(getNavigationLink(ADDRESS, {}), expected);
});
