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

/** Users who see, and can book, every hidden slot as if it were public. */
const HIDDEN_SLOTS_VIEWER_IDS = [1];

const canSeeHiddenSlots = userId => HIDDEN_SLOTS_VIEWER_IDS.includes(Number(userId));

/** A user id that is safe to write straight into SQL, or null. */
const toSafeUserId = userId => {
	const id = Number(userId);

	return Number.isInteger(id) && id > 0 ? id : null;
};

/**
 * SQL condition "this slot is visible to `viewer`", for `slot <alias>`.
 *
 * - no column, or a user of HIDDEN_SLOTS_VIEWER_IDS: every slot
 * - a trainer (`isTrainer`): public slots and their own hidden ones
 * - anyone else, or no viewer: public slots only
 *
 * Pass `isTrainer` only where a trainer should see their own hidden slots (the agenda).
 */
const buildSlotIsPublicCondition = ({ alias = "s", userId = null, isTrainer = false, hasColumn }) => {
	if (!hasColumn || canSeeHiddenSlots(userId)) {
		return "1 = 1";
	}

	const trainerId = isTrainer ? toSafeUserId(userId) : null;
	if (trainerId) {
		return `(${alias}.is_public = 1 OR ${alias}.id_trainer = ${trainerId})`;
	}

	return `${alias}.is_public = 1`;
};

/** buildSlotIsPublicCondition against the real database (user 1 skips the column check). */
const slotIsPublicCondition = async (alias = "s", { userId = null, isTrainer = false } = {}) => {
	if (canSeeHiddenSlots(userId)) {
		return "1 = 1";
	}

	return buildSlotIsPublicCondition({ alias, userId, isTrainer, hasColumn: await hasSlotIsPublicColumn() });
};

/** `s.is_public,` for a SELECT on `slot s` when the column exists, nothing otherwise. */
const slotIsPublicSelect = async (alias = "s") => ((await hasSlotIsPublicColumn()) ? `${alias}.is_public,` : "");

export { normalizeIsPublic, hasSlotIsPublicColumn, canSeeHiddenSlots, buildSlotIsPublicCondition, slotIsPublicCondition, slotIsPublicSelect };
