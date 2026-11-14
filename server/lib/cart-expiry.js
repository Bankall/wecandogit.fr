/*
 * A cart expires 24 hours after its last change, while the session (the login)
 * lasts longer (see server/index.js).
 *
 * The time is kept on the items (`changed_at`, ms timestamp) rather than beside the
 * cart, so it travels wherever the cart is copied (the login routes move
 * `session.cart` to the new session). Every change re-stamps every item
 * (touchCartItems); the cart's age is that of its latest stamp.
 *
 * A cart with an unstamped item (filled before this rule existed) is stamped on
 * first sight rather than dropped, so nobody loses their cart on deploy.
 */

const CART_TTL_MS = 24 * 60 * 60 * 1000;

// Both carts a session can hold (see router/Cart)
const SESSION_CART_KEYS = ["cart", "waiting_list_cart"];

/** `items`, all stamped as changed at `now`. Call on every change to a cart. */
const touchCartItems = (items, now = Date.now()) => (items || []).map(item => ({ ...item, changed_at: now }));

/** The cart as it stands at `now` (emptied once expired), and whether it changed. */
const pruneCartItems = (items, now = Date.now()) => {
	if (!Array.isArray(items) || !items.length) {
		return { items, changed: false };
	}

	if (items.some(item => typeof item.changed_at !== "number")) {
		return { items: touchCartItems(items, now), changed: true };
	}

	const lastChange = Math.max(...items.map(item => item.changed_at));
	if (now - lastChange >= CART_TTL_MS) {
		return { items: [], changed: true };
	}

	return { items, changed: false };
};

/** Prunes every cart of `session` in place. Only writes a key that changed, so an untouched session is not resaved. */
const pruneSessionCarts = (session, now = Date.now()) => {
	if (!session) {
		return;
	}

	SESSION_CART_KEYS.forEach(key => {
		const { items, changed } = pruneCartItems(session[key], now);
		if (changed) {
			session[key] = items;
		}
	});
};

export { CART_TTL_MS, touchCartItems, pruneCartItems, pruneSessionCarts };
