/*
 * Whether a slot shows in the agenda (`slot.is_public`, on by default).
 *
 * A hidden slot exists for its trainer only: it is listed in their dashboard and they
 * can register dogs on it (that route does not go through these checks), but members
 * cannot see it, add it to a cart, book it, nor be offered it from a waiting list.
 *
 * The column is tolerated as absent (the migration may not have run on every
 * database yet): every slot then counts as public, as before.
 */

/** 1/0 from what a form sends (checkbox boolean, "0"/"1", 0/1). Anything unclear means public. */
const normalizeIsPublic = value => (value === false || value === 0 || value === "0" || value === "false" ? 0 : 1);

let slotHasIsPublicColumn = null;
const hasSlotIsPublicColumn = async () => {
	if (slotHasIsPublicColumn === null) {
		// Imported here so the pure helper above loads without a database config
		const { query } = await import("./db.js");
		const columns = await query("SHOW COLUMNS FROM slot LIKE 'is_public'");
		slotHasIsPublicColumn = columns.length > 0;
	}

	return slotHasIsPublicColumn;
};

/** SQL condition "this slot is public", for `slot <alias>`. Always true without the column. */
const slotIsPublicCondition = async (alias = "s") => ((await hasSlotIsPublicColumn()) ? `${alias}.is_public = 1` : "1 = 1");

/** `s.is_public,` for a SELECT on `slot s` when the column exists, nothing otherwise. */
const slotIsPublicSelect = async (alias = "s") => ((await hasSlotIsPublicColumn()) ? `${alias}.is_public,` : "");

export { normalizeIsPublic, hasSlotIsPublicColumn, slotIsPublicCondition, slotIsPublicSelect };
