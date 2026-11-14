import { test } from "node:test";
import assert from "node:assert/strict";

import { normalizeIsPublic, canSeeHiddenSlots, buildSlotIsPublicCondition, slotIsPublicCondition } from "../lib/slot-visibility.js";

test("canSeeHiddenSlots: user 1 sees hidden slots, in any id form", () => {
	assert.equal(canSeeHiddenSlots(1), true);
	assert.equal(canSeeHiddenSlots("1"), true);
});

test("canSeeHiddenSlots: other users and visitors do not", () => {
	assert.equal(canSeeHiddenSlots(2), false);
	assert.equal(canSeeHiddenSlots(0), false);
	assert.equal(canSeeHiddenSlots(undefined), false);
	assert.equal(canSeeHiddenSlots(null), false);
});

test("slotIsPublicCondition: user 1 gets an always-true condition without touching the database", async () => {
	assert.equal(await slotIsPublicCondition("s", { userId: 1 }), "1 = 1");
});

test("buildSlotIsPublicCondition: visitors and members only see public slots", () => {
	assert.equal(buildSlotIsPublicCondition({ hasColumn: true }), "s.is_public = 1");
	assert.equal(buildSlotIsPublicCondition({ userId: 42, hasColumn: true }), "s.is_public = 1");
});

test("buildSlotIsPublicCondition: a trainer also sees their own hidden slots", () => {
	assert.equal(buildSlotIsPublicCondition({ alias: "sl", userId: 42, isTrainer: true, hasColumn: true }), "(sl.is_public = 1 OR sl.id_trainer = 42)");
});

test("buildSlotIsPublicCondition: a trainer id that is not a positive integer never reaches the SQL", () => {
	assert.equal(buildSlotIsPublicCondition({ userId: "42 OR 1=1", isTrainer: true, hasColumn: true }), "s.is_public = 1");
	assert.equal(buildSlotIsPublicCondition({ userId: null, isTrainer: true, hasColumn: true }), "s.is_public = 1");
	assert.equal(buildSlotIsPublicCondition({ userId: 4.5, isTrainer: true, hasColumn: true }), "s.is_public = 1");
});

test("buildSlotIsPublicCondition: user 1 or a database without the column see every slot", () => {
	assert.equal(buildSlotIsPublicCondition({ userId: 1, hasColumn: true }), "1 = 1");
	assert.equal(buildSlotIsPublicCondition({ userId: 42, isTrainer: true, hasColumn: false }), "1 = 1");
});

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
