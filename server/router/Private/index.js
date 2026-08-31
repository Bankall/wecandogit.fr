import { Router } from "express";
import MailSender from "../../lib/mail-sender/index.cjs";
import { errorHandler } from "../../lib/utils.js";
import { query } from "../../lib/db.js";
import { reserveSlot, cancelReservation, consumePackageCredit, CANCELLATION_CUTOFF_HOURS } from "../../lib/booking.js";
import { buildPaymentUrl, buildShortPaymentUrls } from "../../lib/payment-link.js";

import config from "config";

let backend;

const router = Router();
router.route("/ping").get((req, res) => {
	res.send("pong");
});

const getReservationContext = async id_reservation => {
	const rows = await query(
		`SELECT
			r.id,
			r.id_slot,
			r.id_dog,
			r.enabled,
			s.date slot_date,
			d.id_user
		FROM reservation r
		JOIN slot s ON s.id = r.id_slot
		JOIN dog d ON d.id = r.id_dog
		WHERE r.id = ?`,
		[id_reservation]
	);

	return rows[0] || null;
};

router.route(["/activity/:id?", "/slot/:id?", "/package/:id?", "/payment_history"]).all((req, res, next) => {
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
					CONCAT(a.label, ' - ', d.label, ' - ', (select firstname from user where id = s.id_trainer)) label,
					r.id,
					r.paid,
					r.payment_type,
					r.payment_details

				FROM reservation r
				JOIN slot s on s.id = r.id_slot
				JOIN activity a on a.id = s.id_activity
				JOIN dog d on d.id = r.id_dog
				JOIN user u on u.id = d.id_user
				WHERE 	u.id = ? 
				${!req.query.id_user ? "AND 	s.date > current_timestamp()" : ""}
				AND 	r.enabled = 1 
				AND 	s.enabled = 1
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
			if (!req.session.user_id) {
				return res.send({ error: "Vous n'avez pas accès à cette ressource" });
			}

			if (!req.session.is_trainer) {
				// Un client ne peut réserver que pour son propre chien, sur un créneau
				// avec de la place, en passant par le parcours transactionnel
				const dog = await backend.get({ table: "dog", id: req.body.id_dog });
				if (!dog.result || dog.result.id_user !== req.session.user_id) {
					return res.send({ error: "Vous n'avez pas accès à cette ressource" });
				}

				const user_packages = await backend.getUserPackageForID({ id_slot: req.body.id_slot, available: true, req });
				const result = await reserveSlot({
					id_slot: req.body.id_slot,
					id_dog: req.body.id_dog,
					payment_type: user_packages.length ? user_packages[0].id : "later"
				});

				if (result.unavailable || result.full || result.duplicate) {
					return res.send({ error: result.duplicate ? "Vous avez déjà réservé ce créneau" : "Ce créneau n'est plus disponible" });
				}

				await backend.notify({
					who: req.session.user_id,
					action: "booked",
					what: "slot",
					how: typeof result.payment_type === "number" ? result.payment_type : "later",
					package_usage: result.package_usage,
					dog: req.body.id_dog,
					id_what: req.body.id_slot
				});

				return res.send({ id: result.id_reservation });
			}

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
			let package_usage = null;

			if (user_package.length) {
				// Consommation atomique : ne marque payé que si un crédit restait vraiment
				package_usage = await consumePackageCredit(user_package[0].id);

				if (package_usage !== false) {
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
				} else {
					package_usage = null;
				}
			}

			await backend.notify({
				who: req.session.user_id,
				action: "booked",
				what: "slot",
				how: user_package.length && package_usage !== null ? user_package[0].id : "later",
				package_usage,
				dog: req.body.id_dog,
				id_what: req.body.id_slot
			});

			res.send(reservation.result);
		} catch (err) {
			errorHandler({ err, req, res });
		}
	})
	.put(async (req, res, next) => {
		try {
			const reservation = await getReservationContext(req.params.id);
			if (!reservation) {
				return res.send({ error: "Réservation introuvable" });
			}

			const isOwner = reservation.id_user === req.session.user_id;
			if (!req.session.is_trainer && !isOwner) {
				return res.send({ error: "Vous n'avez pas accès à cette ressource" });
			}

			if (req.body.enabled === 0) {
				// Le délai d'annulation n'était vérifié que côté client
				if (!req.session.is_trainer) {
					const cutoff = new Date(Date.now() + CANCELLATION_CUTOFF_HOURS * 60 * 60 * 1000);
					if (new Date(reservation.slot_date) <= cutoff) {
						return res.send({ error: `Annulation impossible à moins de ${CANCELLATION_CUTOFF_HOURS}h du créneau` });
					}
				}

				const outcome = await cancelReservation({ id_reservation: req.params.id, byTrainer: !!req.session.is_trainer });

				if (!outcome.alreadyCancelled) {
					await backend.notify({
						who: req.session.user_id,
						action: "unbooked",
						what: "slot",
						dog: reservation.id_dog,
						how: "",
						package_usage: outcome.package_usage,
						id_what: reservation.id_slot
					});
				}

				return res.send({
					ok: true,
					refund: outcome.refund || null,
					package_usage: outcome.package_usage
				});
			}

			// Seul un éducateur peut marquer une réservation comme payée ou en
			// modifier d'autres champs
			if (!req.session.is_trainer) {
				return res.send({ error: "Vous n'avez pas accès à cette ressource" });
			}

			next();
		} catch (err) {
			errorHandler({ err, req, res });
		}
	});

const getSlotsListing = async (req, res) => {
	try {
		const slots = await backend.handleQuery(
			`SELECT 
			${req.body.all ? "u.firstname trainer," : ""}
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
		${req.body.all ? "JOIN user u on u.id = s.id_trainer" : ""}
	
		WHERE	s.enabled = 1
		AND 	s.date ${req.body.past ? "<" : ">"} current_timestamp()
		${!req.body.all ? "AND 	s.id_trainer = ?" : ""}

		GROUP BY s.id, r.id
		ORDER BY s.date ASC`,
			[req.session.user_id],
			null,
			true
		);

		const waitingList = await backend.handleQuery(
			`SELECT
				s.id id_slot,
				concat(u.firstname, " ", u.lastname) user,
				case when wl.proposed = 1 then "En attente de réponse" else "Sur la liste" end status
				
			FROM waiting_list wl
			JOIN user u on u.id = wl.id_user
			JOIN slot s on s.id = wl.id_slot

			WHERE 	wl.declined = 0
			AND 	s.date > CURRENT_TIMESTAMP
			AND 	s.enabled = 1`,
			[req.session.user_id],
			null,
			true
		);

		const waitingListById = {};
		if (waitingList.result.length) {
			waitingList.result.forEach(item => {
				if (!waitingListById[item.id_slot]) {
					waitingListById[item.id_slot] = [];
				}

				waitingListById[item.id_slot].push({
					label: item.user,
					status: item.status
				});
			});
		}

		const results = {};
		if (slots.result.length) {
			slots.result.forEach(slot => {
				if (!results[slot.id]) {
					results[slot.id] = {
						id: slot.id,
						label: `0 / ${slot.spots}`,
						date: slot.date,
						group_label: slot.label + (slot.trainer ? ` (${slot.trainer})` : ""),
						spots: slot.spots,
						reservations: 0,
						dogs: [],
						waiting_list: waitingListById[slot.id] || {}
					};
				}

				if (slot.id_dog) {
					results[slot.id].dogs.push({
						id: slot.id_dog,
						id_reservation: slot.id_reservation,
						label: slot.label_dog,
						paid: slot.paid,
						payment_type: slot.payment_type
					});

					results[slot.id].reservations += 1;
					const full = results[slot.id].reservations >= results[slot.id].spots;

					results[slot.id].label = `${full ? "Complet" : `${results[slot.id].reservations} / ${slot.spots}`}`;
				}
			});
		}

		// Lien de paiement court, à copier et envoyer au client : il fonctionne même
		// s'il n'est pas connecté. Un seul aller-retour en base pour tout le listing.
		const unpaidDogs = Object.values(results)
			.flatMap(slot => slot.dogs)
			.filter(dog => !dog.paid && dog.id_reservation);

		const payUrls = await buildShortPaymentUrls(unpaidDogs.map(dog => ({ type: "reservation", id: dog.id_reservation })));
		unpaidDogs.forEach(dog => {
			dog.pay_url = payUrls.get(`reservation:${dog.id_reservation}`);
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
				// Annulation par l'éducateur : rembourse crédits de formule ET paiements
				// Stripe de toutes les réservations actives du créneau
				const reservations = await backend.get({
					table: "reservation",
					query: {
						id_slot: req.params.id,
						enabled: 1
					}
				});

				for (const reservation of reservations.result || []) {
					await cancelReservation({ id_reservation: reservation.id, byTrainer: true });
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

router.route("/all_slot").get(async (req, res) => {
	try {
		req.body.all = true;
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
		if (!req.session.is_trainer) {
			return res.send({ error: "Vous n'avez pas accès à cette ressource" });
		}

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
				label: `${dog.label} (${dog.breed} ${dog.sexe})`,
				id: dog.id
			});
		});

		res.send(
			users.result
				.filter(user => user.id !== 2 && user.firstname)
				.map(user => {
					// Jamais de secrets dans une réponse, même pour un éducateur
					delete user.password;
					delete user.stripe_sk;
					delete user.stripe_whsec;

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
		// Un membre ne consulte que ses propres formules, quel que soit le paramètre
		const id_user = req.session.is_trainer ? req.query.id_user || req.session.user_id : req.session.user_id;

		const user_packages = await backend.get({
			table: "user_package",
			query: { id_user }
		});

		if (user_packages.result.length) {
			for await (const user_package of user_packages.result) {
				const _package = await backend.get({
					table: "package",
					id: user_package.id_package
				});

				user_package.label = `${_package.result.label} - ${user_package.usage}/${_package.result.number_of_session} - ${user_package.start}`;
			}

			// Lien de paiement d'une formule non réglée. Côté éducateur c'est un lien
			// court, copié puis envoyé au client (qui n'est pas forcément connecté) ;
			// côté membre, le lien direct suffit, sa session l'autorise.
			const unpaid = user_packages.result.filter(user_package => !user_package.paid);
			const payUrls = req.session.is_trainer ? await buildShortPaymentUrls(unpaid.map(user_package => ({ type: "user_package", id: user_package.id }))) : null;

			unpaid.forEach(user_package => {
				user_package.pay_url = payUrls ? payUrls.get(`user_package:${user_package.id}`) : buildPaymentUrl({ type: "user_package", id: user_package.id });
			});
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
		if (!req.session.is_trainer) {
			return res.send({ error: "Vous n'avez pas accès à cette ressource" });
		}

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
				end paid
                
			FROM notification n
			JOIN user u on u.id = n.id_user
			LEFT OUTER JOIN reservation r on r.id = n.detail_what
			LEFT OUTER JOIN user_package up on up.id = n.detail_what
			WHERE n.when > date_sub(current_timestamp, interval 1 month)
			ORDER BY n.id DESC`,
			[],
			null,
			true
		);

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

		res.send(
			notifications.result.map(notification => {
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

/*
 * "Mes paiements en attente" : tout ce qui reste à régler, quelle qu'en soit la
 * raison (choisi "à régler sur place", paiement en ligne abandonné ou échoué),
 * avec un lien de paiement par élément. Les tentatives de paiement en ligne non
 * abouties de moins de 24h sont listées à part, avec le lien de leur session
 * Stripe encore ouverte.
 *
 * Les impayés de plus de 3 mois ne sont plus listés : ce sont pour l'essentiel
 * des séances anciennes réglées en personne mais jamais pointées comme payées.
 * L'éducateur les retrouve dans ses créneaux passés (avec un lien de paiement).
 * Tout ce qui est à venir reste listé, même au-delà de 3 mois.
 */
const UNPAID_HISTORY_MONTHS = 3;

router.route("/unpaid_cart").get(async (req, res) => {
	try {
		if (!req.session.user_id) {
			return res.send([]);
		}

		const formatPrice = price => `${parseFloat(price)}€`;

		const failedCheckouts = await query(
			`SELECT
				pa.session_id,
				pa.details,
				pa.created_at date,
				concat(u.firstname, ' ', u.lastname) trainer

			FROM payment_activity pa
			JOIN user u ON u.id = pa.id_trainer
			LEFT JOIN payment_history ph ON ph.session_id = pa.session_id

			WHERE 	pa.id_user = ?
			AND 	ph.session_id IS NULL
			AND 	pa.created_at > date_sub(current_timestamp, interval 24 hour)

			ORDER BY pa.created_at DESC`,
			[req.session.user_id]
		);

		const reservations = await query(
			`SELECT
				r.id,
				r.paid,
				r.payment_type,
				r.payment_details,
				s.date,
				a.label,
				a.price,
				d.label dog

			FROM reservation r
			JOIN slot s ON s.id = r.id_slot
			JOIN activity a ON a.id = s.id_activity
			JOIN dog d ON d.id = r.id_dog

			WHERE 	d.id_user = ?
			AND 	r.enabled = 1
			AND 	r.paid = 0
			AND 	s.date > date_sub(current_timestamp, interval ? month)

			ORDER BY s.date DESC`,
			[req.session.user_id, UNPAID_HISTORY_MONTHS]
		);

		const user_packages = await query(
			`SELECT
				up.id,
				up.paid,
				up.payment_type,
				up.payment_details,
				up.start date,
				p.label,
				p.price,
				p.number_of_session

			FROM user_package up
			JOIN package p ON p.id = up.id_package

			WHERE 	up.id_user = ?
			AND 	up.paid = 0
			AND 	up.start > date_sub(current_timestamp, interval ? month)

			ORDER BY up.start DESC`,
			[req.session.user_id, UNPAID_HISTORY_MONTHS]
		);

		res.send([
			...failedCheckouts.map(checkout => {
				const details = checkout.details ? JSON.parse(checkout.details) : [];

				return {
					id: checkout.session_id,
					group_label: "Paiement en ligne non abouti",
					label: `${checkout.trainer} - ${formatPrice(details.reduce((total, item) => total + parseFloat(item.price || 0), 0))}`,
					date: checkout.date,
					paid: 0,
					payment_type: "direct",
					payment_details: checkout.session_id,
					details,
					// Reprise de la session Stripe existante (encore ouverte)
					pay_url: `${config.get("BACK_URI")}/api/v1/cart/stripe-redirect-no-trainer/${checkout.session_id}`
				};
			}),
			...reservations.map(reservation => ({
				id: reservation.id,
				group_label: "Réservation",
				label: `${reservation.label} - ${reservation.dog} - ${formatPrice(reservation.price)}`,
				date: reservation.date,
				paid: reservation.paid,
				payment_type: reservation.payment_type,
				payment_details: reservation.payment_details,
				pay_url: buildPaymentUrl({ type: "reservation", id: reservation.id })
			})),
			...user_packages.map(user_package => ({
				id: user_package.id,
				group_label: "Formule",
				label: `${user_package.label} - ${user_package.number_of_session} séances - ${formatPrice(user_package.price)}`,
				date: user_package.date,
				paid: user_package.paid,
				payment_type: user_package.payment_type,
				payment_details: user_package.payment_details,
				pay_url: buildPaymentUrl({ type: "user_package", id: user_package.id })
			}))
		]);
	} catch (err) {
		errorHandler({ err, req, res });
	}
});

router.route("/payment_history").get(async (req, res) => {
	try {
		const payments = await backend.handleQuery(
			`SELECT
				u.firstname,
				u.lastname,
				p.amount,
				p.date,
				p.status,
				p.details
			FROM payment_history p
			JOIN user u on u.id = p.id_user
			WHERE p.id_trainer = ?
			ORDER BY p.date DESC`,
			[req.session.user_id],
			null,
			true
		);

		res.send(
			payments.result.map(payment => {
				payment.label = `${payment.firstname} ${payment.lastname} - ${payment.amount / 100}€ - ${payment.status}`;
				payment.details = JSON.parse(payment.details);

				return payment;
			})
		);
	} catch (err) {
		//console.log(err);
		errorHandler({ err, req, res });
	}
});

const Private = _backend => {
	backend = _backend;
	return router;
};

export { Private };
