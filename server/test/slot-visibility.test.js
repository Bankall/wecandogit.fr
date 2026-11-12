import { test } from "node:test";
import assert from "node:assert/strict";

import { normalizeIsPublic } from "../lib/slot-visibility.js";

test("normalizeIsPublic: an unticked checkbox, in any form, hides the slot", () => {
	assert.equal(normalizeIsPublic(false), 0);
	assert.equal(normalizeIsPublic(0), 0);
	assert.equal(normalizeIsPublic("0"), 0);
	assert.equal(normalizeIsPublic("false"), 0);
});

test("normalizeIsPublic: ticked, or anything unclear, keeps the slot public", () => {
	assert.equal(normalizeIsPublic(true), 1);
	assert.equal(normalizeIsPublic(1), 1);
	assert.equal(normalizeIsPublic("1"), 1);
	assert.equal(normalizeIsPublic(undefined), 1);
	assert.equal(normalizeIsPublic(null), 1);
	assert.equal(normalizeIsPublic(""), 1);
});
