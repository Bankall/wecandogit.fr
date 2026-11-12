/*
 * Where a slot takes place (`slot.location`). Nullable: a trainer may not know yet
 * where a session will happen, and slots created before the column existed have
 * none. The default address only comes from the UI, which pre-fills the slot
 * creation form with the association's park; the column itself has no default.
 *
 * Writes go through raw SQL, not the generic CRUD: the CRUD turns a null into the
 * string "null", and stores an emptied field as "" — neither is "not known yet".
 *
 * The column is tolerated as absent (the migration may not have run on every
 * database yet): listings then carry no location and writes skip it.
 */

const DEFAULT_SLOT_LOCATION = "We Can Dog It, Les Sables, 51370 Les Mesneux";
const LOCATION_MAX_LENGTH = 255;

/** Trimmed text, or null for "not known yet" (empty, blank, missing). */
const normalizeSlotLocation = value => {
	if (typeof value !== "string") {
		return null;
	}

	const trimmed = value.trim().replace(/\s+/g, " ");
	return trimmed ? trimmed.slice(0, LOCATION_MAX_LENGTH) : null;
};

let slotHasLocationColumn = null;
const hasSlotLocationColumn = async () => {
	if (slotHasLocationColumn === null) {
		// Imported here so the pure helpers above load without a database config
		const { query } = await import("./db.js");
		const columns = await query("SHOW COLUMNS FROM slot LIKE 'location'");
		slotHasLocationColumn = columns.length > 0;
	}

	return slotHasLocationColumn;
};

/** `s.location,` for a SELECT on `slot s` when the column exists, nothing otherwise. */
const slotLocationSelect = async (alias = "s") => ((await hasSlotLocationColumn()) ? `${alias}.location,` : "");

/**
 * Sets (or clears) a slot's location. With `id_trainer`, only on that trainer's own slot.
 * Returns { previous, location } (the stored values before and after), or false when the
 * column does not exist yet or the slot is not found (or not theirs).
 */
const saveSlotLocation = async (id_slot, value, { id_trainer } = {}) => {
	if (!(await hasSlotLocationColumn())) {
		return false;
	}

	const { query } = await import("./db.js");
	const ownership = id_trainer ? " AND id_trainer = ?" : "";
	const params = id_trainer ? [id_slot, id_trainer] : [id_slot];

	const rows = await query(`SELECT location FROM slot WHERE id = ?${ownership}`, params);
	if (!rows.length) {
		return false;
	}

	const location = normalizeSlotLocation(value);
	await query(`UPDATE slot SET location = ? WHERE id = ?${ownership}`, [location, ...params]);

	return { previous: rows[0].location, location };
};

export { DEFAULT_SLOT_LOCATION, normalizeSlotLocation, hasSlotLocationColumn, slotLocationSelect, saveSlotLocation };
