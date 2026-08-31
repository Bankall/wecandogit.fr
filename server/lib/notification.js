import { query } from "./db.js";

/*
 * Notifications are the trainers' activity feed: one row per booking,
 * cancellation, waiting-list entry or package purchase. This module owns both
 * the reading of that feed (/notification) and the wording of a single event,
 * so the list in the dashboard and the push notification sent to the trainer's
 * device always describe an event the same way.
 */

const DEFAULT_HISTORY_MONTHS = 1;

/*
 * `id_trainer` is not stored on the notification row: it is derived from the
 * slot or the package the event is about. That is what makes a notification
 * "belong" to a trainer, both for the per-trainer filter and for push routing.
 */
const NOTIFICATION_SELECT = `
	SELECT
		n.id notification_id,
		n.id_what id,
		concat(u.firstname, ' ', u.lastname) who,
		n.action,
		case
			when n.what = 'slot' then (select concat(a.label, ' ', DATE_FORMAT(s.date, '%d/%m')) from slot s join activity a on a.id = s.id_activity where s.id = n.id_what)
			when n.what = 'package' then (select label from package where id = n.id_what)
		end what,
		n.what type,
		n.when date,
		(select label from dog where id = n.dog) dog,
		case
			when n.how REGEXP '^[0-9]+$' then (select p.label from user_package up join package p on p.id = up.id_package where up.id = n.how)
			else n.how
		end how,
		case when n.package_usage is not null then concat(n.package_usage, "/", (select p.number_of_session from package p join user_package up on up.id_package = p.id where up.id = n.how))
			else null
		end package_usage,
		case
			when n.what = "slot" then r.paid
			when n.what = "package" then up.paid
		end paid,
		case
			when n.what = 'slot' then (select s.id_trainer from slot s where s.id = n.id_what)
			when n.what = 'package' then (select p.id_trainer from package p where p.id = n.id_what)
		end id_trainer

	FROM notification n
	JOIN user u on u.id = n.id_user
	LEFT OUTER JOIN reservation r on r.id = n.detail_what
	LEFT OUTER JOIN user_package up on up.id = n.detail_what`;

const formatAction = notification => {
	if (notification.type === "slot") {
		return notification.action === "booked" ? "a réservé" : notification.action === "unbooked" ? "a annulé" : "s'est inscrit sur la liste d'attente pour";
	}

	if (notification.type === "package") {
		return notification.how === "direct" ? "a acheté" : "a commandé";
	}
};

const formatPayment = notification => {
	if (["unbooked", "waiting-list"].includes(notification.action)) {
		return "";
	}

	if (notification.type === "package") {
		return "";
	}

	if (!["direct", "later"].includes(notification.how)) {
		return `avec la formule <b>${notification.how}</b>`;
	}

	return ``;
};

/*
 * Turns a raw row into what the dashboard renders: an HTML label plus the
 * payment badge. Mutates and returns the row, as the previous inline version
 * did.
 */
const decorateNotification = notification => {
	notification.label = `<b>${notification.who}</b> ${formatAction(notification)} ${notification.type === "slot" ? "le créneau" : "la formule"} <b>${notification.what}</b> ${notification.dog ? `pour <b>${notification.dog}</b>` : ""} ${formatPayment(notification)}`;

	if (notification.action === "booked") {
		notification.paid = notification.how === "direct" ? notification.paid : notification.how !== "later";

		if (notification.paid) {
			notification.payment_type = notification.how !== "direct" ? "package" : notification.how;
		}
	} else {
		delete notification.paid;
	}

	if (notification.package_usage) {
		notification.label += ` (utilisation: ${notification.package_usage})`;
	}

	return notification;
};

/*
 * Same wording as the dashboard label, without markup: push notification
 * bodies are plain text.
 */
const toPlainText = notification => {
	return decorateNotification({ ...notification })
		.label.replace(/<[^>]+>/g, "")
		.replace(/\s+/g, " ")
		.trim();
};

/*
 * `id_trainer` is a derived column, so filtering on it has to happen outside
 * the select that computes it.
 */
const listNotifications = async ({ id_trainer = null, months = DEFAULT_HISTORY_MONTHS } = {}) => {
	const rows = await query(
		`SELECT * FROM (
			${NOTIFICATION_SELECT}
			WHERE n.when > date_sub(current_timestamp, interval ? month)
		) notifications
		${id_trainer ? "WHERE id_trainer = ?" : ""}
		ORDER BY notification_id DESC`,
		id_trainer ? [months, id_trainer] : [months]
	);

	return rows.map(decorateNotification);
};

const getNotification = async id => {
	const rows = await query(`${NOTIFICATION_SELECT} WHERE n.id = ?`, [id]);
	return rows[0] || null;
};

export { listNotifications, getNotification, decorateNotification, toPlainText };
