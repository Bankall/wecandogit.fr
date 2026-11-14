import { test } from "node:test";
import assert from "node:assert/strict";

import { CART_TTL_MS, touchCartItems, pruneCartItems, pruneSessionCarts } from "../lib/cart-expiry.js";

const NOW = 1_800_000_000_000;

test("touchCartItems: stamps every item with the change time, without mutating the input", () => {
	const items = [{ id: 1, changed_at: NOW - 5000 }, { id: 2 }];
	const touched = touchCartItems(items, NOW);

	assert.deepEqual(touched, [
		{ id: 1, changed_at: NOW },
		{ id: 2, changed_at: NOW }
	]);
	assert.equal(items[0].changed_at, NOW - 5000);
});

test("touchCartItems: no cart gives an empty one", () => {
	assert.deepEqual(touchCartItems(undefined, NOW), []);
});

test("pruneCartItems: a cart changed less than 24 hours ago is kept, untouched", () => {
	const items = [{ id: 1, changed_at: NOW - CART_TTL_MS + 1 }];
	const result = pruneCartItems(items, NOW);

	assert.equal(result.changed, false);
	assert.equal(result.items, items);
});

test("pruneCartItems: a cart unchanged for 24 hours or more is emptied", () => {
	const result = pruneCartItems([{ id: 1, changed_at: NOW - CART_TTL_MS }, { id: 2, changed_at: NOW - 2 * CART_TTL_MS }], NOW);

	assert.deepEqual(result, { items: [], changed: true });
});

test("pruneCartItems: the cart's age is that of its latest change", () => {
	const items = [{ id: 1, changed_at: NOW - 2 * CART_TTL_MS }, { id: 2, changed_at: NOW - 1000 }];

	assert.equal(pruneCartItems(items, NOW).changed, false);
});

test("pruneCartItems: a cart from before the rule is stamped instead of dropped", () => {
	const result = pruneCartItems([{ id: 1, type: "slot" }, { id: 2, changed_at: NOW - 3 * CART_TTL_MS }], NOW);

	assert.equal(result.changed, true);
	assert.deepEqual(result.items, [
		{ id: 1, type: "slot", changed_at: NOW },
		{ id: 2, changed_at: NOW }
	]);
});

test("pruneCartItems: no cart, or an empty one, is left as it is", () => {
	assert.deepEqual(pruneCartItems(undefined, NOW), { items: undefined, changed: false });
	assert.equal(pruneCartItems([], NOW).changed, false);
});

test("pruneSessionCarts: prunes both carts and leaves the rest of the session alone", () => {
	const session = {
		user_id: 7,
		cart: [{ id: 1, changed_at: NOW - 1000 }],
		waiting_list_cart: [{ id: 3, changed_at: NOW - CART_TTL_MS - 1 }]
	};

	pruneSessionCarts(session, NOW);

	assert.equal(session.user_id, 7);
	assert.deepEqual(session.cart, [{ id: 1, changed_at: NOW - 1000 }]);
	assert.deepEqual(session.waiting_list_cart, []);
});

test("pruneSessionCarts: does not create a cart key on a session without one", () => {
	const session = { user_id: 7 };
	pruneSessionCarts(session, NOW);

	assert.deepEqual(session, { user_id: 7 });
});

test("pruneSessionCarts: tolerates no session", () => {
	assert.doesNotThrow(() => pruneSessionCarts(undefined, NOW));
});
