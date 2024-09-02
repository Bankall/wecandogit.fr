import { Router } from "express";
import MailSender from "../../lib/mail-sender/index.cjs";
import { errorHandler } from "../../lib/utils.js";
let backend;

const router = Router();
router.route("/ping").get((req, res) => {
	res.send("pong");
});

const handleRefund = async ({ id_reservation, req }) => {
	try {
		const reservation = await backend.get({
			table: "reservation",
			id: id_reservation
		});

		if (reservation.result.paid === 1 && reservation.result.payment_type === "package") {
			const user_package = await backend.get({
				table: "user_package",
				id: reservation.result.payment_details
			});

			await backend.put({
				table: "user_package",
				where: {
					id: reservation.result.payment_details
				},
				body: {
					usage: user_package.result.usage - 1
				}
			});
		}
	} catch (err) {
		errorHandler({ err, req });
	}
};

router.route(["/activity/:id?", "/slot/:id?", "/package/:id?"]).all((req, res, next) => {
	if (!req.session.is_trainer) {
		return res.send({
			error: "Vous n'avez pas accès à cette ressource"
		});
	}

	if (!req.body.id_trainer) {
		req.body.id_trainer = req.session.user_id;
	}

	req.where = Object.assign({ id_trainer: req.body.id_trainer }, req.where);

	if (typeof req.query.full === "undefined") {
		req.query = Object.assign({ id_trainer: req.body.id_trainer }, req.query);
	}

	next();
});

router.route("/user_package").all(async (req, res, next) => {
	if (req.query.id && !req.session.is_trainer) {
		return res.send({
			error: "Vous n'avez pas accès à cette ressource"
		});
	}

	next();
});

router.route("/all_user_package").all(async (req, res, next) => {
	try {
		const user_packages = await backend.handleQuery(
			`SELECT
				up.id,
				u.id id_user,
				concat(u.firstname, " ", u.lastname) user,
				p.label,
				up.usage,
				p.number_of_session,
				up.start date
				
			FROM user_package up
			JOIN user u on u.id = up.id_user
			JOIN package p on p.id = up.id_package

			ORDER BY up.id DESC`,
			[],
			null,
			true
		);

		const formatUsage = user_package => {
			const full = user_package.usage >= user_package.number_of_session;
			return full ? "<b>Complet</b>" : `${user_package.usage}/${user_package.number_of_session}`;
		};

		res.send(
			user_packages.result.map(user_package => {
				user_package.label = `<b>${user_package.user}</b> - <b>${user_package.label}</b> - ${formatUsage(user_package)}`;

				return user_package;
			})
		);
	} catch (err) {
		errorHandler({ err, req, res });
	}
});

router
	.route("/package/:id")
	.put(async (req, res, next) => {
		try {
			const activities = req.body.activity;
			req.body.activity = Object.keys(activities).filter(activityId => !!activities[activityId]);

			const values = req.body.activity.map(activityId => {
				return [req.params.id, activityId];
			});

			await backend.handleQuery("DELETE FROM package_activity WHERE id_package = ?", [req.params.id]);
			await backend.handleQuery("INSERT INTO package_activity (id_package, id_activity) values ?", [values], "put-package", true);

			next();
		} catch (err) {
			errorHandler({ err, req, res });
		}
	})
	.get(async (req, res) => {
		try {
			const data = await backend.get({
				table: "package",
				id: req.params.id
			});

			if (req.params.id) {
				const package_activities = await backend.get({
					table: "package_activity",
					query: {
						id_package: req.params.id
					}
				});

				if (package_activities.result.length) {
					data.result.activity = package_activities.result.map(item => item.id_activity);
				}
			}

			res.send(data.result);
		} catch (err) {
			errorHandler({ err, req, res });
		}
	});

router
	.route("/reservation/:id?")
	.get(async (req, res) => {
		try {
			const reservation = await backend.handleQuery(
				`SELECT 
				s.date,
				CONCAT(a.label, ' - ', d.label) label,
				r.id

			FROM reservation r 
			JOIN slot s on s.id = r.id_slot
			JOIN activity a on a.id = s.id_activity
			JOIN dog d on d.id = r.id_dog
			JOIN user u on u.id = d.id_user
			WHERE 	u.id = ? 
			AND 	r.enabled = 1 
			AND 	s.enabled = 1
			${!req.query.id_user ? "AND 	s.date > current_timestamp()" : ""}
			ORDER BY s.date ${req.query.id_user ? "DESC" : "ASC"}`,
				[req.query.id_user || req.session.user_id],
				null,
				true
			);

			res.send(reservation.result);
		} catch (err) {
			errorHandler({ err, req, res });
		}
	})
	.post(async (req, res, next) => {
		try {
			if (!req.body.id_dog && req.body.dog_label) {
				const dog = await backend.post({
					table: "dog",
					body: {
						id_user: 2,
						label: req.body.dog_label
					}
				});

				req.body.id_dog = dog.result.id;
			}

			const reservation = await backend.post({
				table: "reservation",
				body: req.body
			});

			const user_package = await backend.getUserPackageForID({ id_reservation: reservation.result.id, req, available: true });
			if (user_package.length) {
				await backend.put({
					table: "user_package",
					where: {
						id: user_package[0].id
					},
					body: {
						usage: user_package[0].usage + 1
					}
				});

				await backend.put({
					table: "reservation",
					where: {
						id: reservation.result.id
					},
					body: {
						paid: 1,
						payment_details: user_package[0].id,
						payment_type: "package"
					}
				});
			}

			await backend.notify({
				who: req.session.user_id,
				action: "booked",
				what: "slot",
				how: "",
				id_what: reservation.result.id_slot
			});

			res.send(reservation.result);
		} catch (err) {
			errorHandler({ err, req, res });
		}
	})
	.put(async (req, res, next) => {
		try {
			if (req.body.enabled === 0) {
				handleRefund({ id_reservation: req.params.id, req });

				const reservation = await backend.get({ table: "reservation", id: req.params.id });

				await backend.notify({
					who: req.session.user_id,
					action: "unbooked",
					what: "slot",
					how: "",
					id_what: reservation.result.id_slot
				});
			}
		} catch (err) {
			errorHandler({ err, req });
		}

		next();
	});

const getSlotsListing = async (req, res) => {
	try {
		const slots = await backend.handleQuery(
			`SELECT 
			s.id,
			s.date,
			a.label,
			a.spots,
			r.id_dog,
			r.id id_reservation,
			r.paid,
			r.payment_type,
			CASE WHEN d.breed != "" THEN concat(d.label, ' (', d.breed, ' ', d.sexe, ')') ELSE concat(d.label, " *") END label_dog
			
		FROM slot s
		JOIN activity a on a.id = s.id_activity
		LEFT JOIN reservation r on r.id_slot = s.id and r.enabled = 1
		LEFT JOIN dog d on d.id = r.id_dog

		WHERE	s.id_trainer = ?
		AND 	s.date ${req.body.past ? "<" : ">"} current_timestamp()
		AND 	s.enabled = 1

		GROUP BY s.id, r.id
		ORDER BY s.date ASC`,
			[req.session.user_id],
			null,
			true
		);

		const results = {};
		slots.result.forEach(slot => {
			if (!results[slot.id]) {
				results[slot.id] = {
					id: slot.id,
					label: `0 / ${slot.spots}`,
					date: slot.date,
					group_label: slot.label,
					spots: slot.spots,
					reservations: 0,
					dogs: []
				};
			}

			if (slot.id_dog) {
				results[slot.id].dogs.push({
					id: slot.id_reservation,
					label: slot.label_dog,
					paid: slot.paid,
					payment_type: slot.payment_type
				});

				results[slot.id].reservations += 1;
				const full = results[slot.id].reservations >= results[slot.id].spots;

				results[slot.id].label = `${full ? "Complet" : `${results[slot.id].reservations} / ${slot.spots}`}`;
			}
		});

		res.send(
			Object.values(results)
				.sort((a, b) => {
					if (req.body.past) {
						return a.date < b.date ? 1 : -1;
					}

					return a.date > b.date ? 1 : -1;
				})
				.filter(item => !req.body.past || item.reservations > 0)
		);
	} catch (err) {
		errorHandler({ err, req, res });
	}
};

router
	.route("/slot/:id?")
	.get(async (req, res, next) => {
		if (req.params.id) {
			return next();
		}

		return await getSlotsListing(req, res);
	})
	.put(async (req, res, next) => {
		try {
			if (req.body.enabled === 0) {
				const reservations = await backend.get({
					table: "reservation",
					query: {
						id_slot: req.params.id,
						enabled: 1,
						payment_type: "package"
					}
				});

				if (reservations.result.length) {
					for await (const reservation of reservations.result) {
						await handleRefund({ id_reservation: reservation.id, req });
					}
				}
			}

			next();
		} catch (err) {
			errorHandler({ err, req });
		}
	});

router.route("/past_slot").get(async (req, res) => {
	try {
		req.body.past = true;
		return await getSlotsListing(req, res);
	} catch (err) {
		errorHandler({ err, req, res });
	}
});

router.route("/create-slots").post(async (req, res) => {
	try {
		for await (const date of req.body.date) {
			if (!date) {
				continue;
			}
			await backend.post({
				table: "slot",
				body: {
					id_trainer: req.session.user_id,
					id_activity: req.body.id_activity,
					date
				}
			});
		}

		res.send({
			ok: true
		});
	} catch (err) {
		errorHandler({ err, req, res });
	}
});

router.route("/user").get(async (req, res) => {
	try {
		const users = await backend.get({
			table: "user"
		});

		const dogByUser = {};
		const dogs = await backend.get({
			table: "dog"
		});

		dogs.result.forEach(dog => {
			if (!dogByUser[dog.id_user]) {
				dogByUser[dog.id_user] = [];
			}

			dogByUser[dog.id_user].push({
				label: `${dog.label} (${dog.breed} ${dog.sexe})`
			});
		});

		res.send(
			users.result
				.filter(user => user.id !== 2 && user.firstname)
				.map(user => {
					user.label = `<a href="tel:${user.phone}"><i class="fa-solid fa-phone"></i></a> ${user.firstname} ${user.lastname} <a href="mailto:${user.email}" target="_blank">&lt;${user.email}&gt;</a>`;
					user.dogs = dogByUser[user.id];
					return user;
				})
		);
	} catch (err) {
		errorHandler({ err, req, res });
	}
});

router.route("/user_package").get(async (req, res) => {
	try {
		const user_packages = await backend.get({
			table: "user_package",
			query: {
				id_user: req.query.id_user || req.session.user_id
			}
		});

		if (user_packages.result.length) {
			for await (const user_package of user_packages.result) {
				const _package = await backend.get({
					table: "package",
					id: user_package.id_package
				});

				user_package.label = `${_package.result.label} - ${user_package.usage}/${_package.result.number_of_session}`;
			}
		}

		res.send(user_packages.result);
	} catch (err) {
		errorHandler({ err, req, res });
	}
});

router.route("/unpaid_user_package").get(async (req, res) => {
	try {
		const user_packages = await backend.handleQuery(
			`
			SELECT 
				up.id,
				concat(u.firstname, " ", u.lastname, " - ", p.label) label

			FROM user_package up
			JOIN package p on p.id = up.id_package
			JOIN user u on u.id = up.id_user

			WHERE 	p.id_trainer = ?
			AND 	up.paid = 0

			ORDER BY up.start DESC
			`,
			[req.session.user_id],
			null,
			true
		);

		res.send(user_packages.result);
	} catch (err) {
		errorHandler({ err, req, res });
	}
});

router
	.route("/dog/:id?")
	.get(async (req, res) => {
		try {
			const query = {};
			if (req.params.id) {
				query.id = req.params.id;
			} else {
				query.id_user = req.session.user_id;
			}

			const dog = await backend.get({
				table: "dog",
				query
			});

			if (!req.session.is_trainer) {
				dog.result.forEach(dog => {
					delete dog.trainer_description;
				});
			}

			res.send(req.params.id ? dog.result[0] : dog.result);
		} catch (err) {
			errorHandler({ err, req, res });
		}
	})
	.post(async (req, res, next) => {
		req.body.id_user = req.session.user_id;
		next();
	})
	.put(async (req, res, next) => {
		if (req.session.is_trainer) {
			return next();
		}

		if (req.params.id) {
			const dog = await backend.get({
				table: "dog",
				id: req.params.id
			});

			if (dog.result.id_user !== req.session.user_id) {
				return res.send({
					error: "Vous n'avez pas accès à cette ressource"
				});
			}
		}

		next();
	});

router.route("/all-dogs").get(async (req, res) => {
	try {
		const dogs = await backend.get({
			table: "dog"
		});

		const users = await backend.get({
			table: "user"
		});

		const usersById = {};
		users.result.forEach(user => {
			usersById[user.id] = `${user.firstname} ${user.lastname}`;
		});

		res.send(
			dogs.result
				.map(dog => {
					if (!dog.breed) {
						return;
					}

					return {
						label: `${dog.label} (${dog.breed} ${dog.sexe}) - ${usersById[dog.id_user]}`,
						id: dog.id
					};
				})
				.filter(dog => !!dog)
				.sort((a, b) => {
					return a.label.localeCompare(b.label);
				})
		);
	} catch (err) {
		errorHandler({ err, req, res });
	}
});

const getEmailListing = async req => {
	try {
		if (req.body.to === "all") {
			const users = await backend.get({
				table: "user",
				query: {
					newsletter_optin: 1
				}
			});

			return { tos: users.result.map(user => user.email), EMAIL_TYPE: "newsletter" };
		}

		if (req.body.to === "active") {
			const users = await backend.handleQuery("SELECT email FROM user WHERE firstname IS NOT NULL and newsletter_optin = 1", [], null, true);

			return { tos: users.result.map(user => user.email), EMAIL_TYPE: "newsletter" };
		}

		const users = await backend.handleQuery(
			`SELECT 
				email 
			FROM user u

			JOIN dog d on d.id_user = u.id
			JOIN reservation r on r.id_dog = d.id

			WHERE r.id_slot = ?
			AND r.enabled = 1

			GROUP BY u.id`,
			[req.body.to],
			null,
			true
		);

		return { tos: users.result.map(user => user.email), EMAIL_TYPE: "direct" };
	} catch (err) {
		errorHandler({ err, req });
	}
};

router.route("/send-mail").post(async (req, res) => {
	try {
		const content = req.body.content;
		const { tos, EMAIL_TYPE } = await getEmailListing(req);

		for await (const to of tos) {
			await MailSender.send({
				subject: req.body.subject,
				email: to,
				macros: {
					PRE_HEADER: req.body.subject,
					CONTENT_HTML: content,
					EMAIL_TYPE,
					EMAIL: to
				}
			});
		}

		res.send({
			ok: true
		});
	} catch (err) {
		errorHandler({ err, req, res });
	}
});

router.route("/notification").get(async (req, res) => {
	try {
		const notifications = await backend.handleQuery(
			`SELECT
				n.id_what id,
				concat(u.firstname, ' ', u.lastname) who, 
				n.action,
				case
					when n.what = 'slot' then (select concat(a.label, ' ', DATE_FORMAT(s.date, '%d/%m')) from reservation r join slot s on s.id = r.id_slot join activity a on a.id = s.id_activity where s.id = n.id_what group by s.id)
					when n.what = 'package' then (select label from package where id = n.id_what) 
				end what,
				n.what type,
				n.when date,
				case
					when n.how REGEXP '^[0-9]+$' then (select p.label from user_package up join package p on p.id = up.id_package where up.id = n.how)
					else n.how
				end how
			FROM notification n
			JOIN user u on u.id = n.id_user
			ORDER BY n.id DESC`,
			[],
			null,
			true
		);

		const formatAction = notification => {
			if (notification.type === "slot") {
				return notification.action === "booked" ? "a réservé" : "a annulé";
			}

			if (notification.type === "package") {
				return notification.how === "direct" ? "a acheté" : "a commandé";
			}
		};

		const formatPayment = notification => {
			if (notification.action === "unbooked") {
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

		res.send(
			notifications.result.map(notification => {
				notification.label = `<b>${notification.who}</b> ${formatAction(notification)} ${notification.type === "slot" ? "le créneau" : "la formule"} <b>${notification.what}</b> ${formatPayment(notification)}`;

				if (notification.action === "booked") {
					notification.paid = notification.how !== "later";

					if (notification.paid) {
						notification.payment_type = notification.how !== "direct" ? "package" : notification.how;
					}
				}

				return notification;
			})
		);
	} catch (err) {
		errorHandler({ err, req, res });
	}
});

router.route("/user-count").get(async (req, res) => {
	try {
		const users = await backend.handleQuery(
			`SELECT
				count(*) full,
				sum(case when firstname is not null then 1 else 0 end) active

			FROM user WHERE newsletter_optin = 1`
		);

		res.send(users.result);
	} catch (err) {
		errorHandler({ err, req, res });
	}
});

const Private = _backend => {
	backend = _backend;
	return router;
};

export { Private };
