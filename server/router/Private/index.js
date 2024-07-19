import { Router } from "express";

let backend;

const router = Router();
router.route("/ping").get((req, res) => {
	res.send("pong");
});

const getUserPackageFromIdReservation = async id_reservation => {
	try {
		const user_package = await backend.handleQuery(
			`
			SELECT
			up.id,
			up.usage,
			p.number_of_session
			
			FROM user_package up
			JOIN package p on p.id = up.id_package
			JOIN dog d on d.id_user = up.id_user
			JOIN reservation r on r.id_dog = d.id
			JOIN slot s on s.id = r.id_slot
			JOIN package_activity pa on pa.id_activity = s.id_activity
			
		WHERE r.id = ?
		GROUP BY up.id`,
			[id_reservation]
		);

		return user_package.result;
	} catch (err) {
		console.log(err);
		return false;
	}
};

router.route(["/activity/:id?", "/slot/:id?", "/package/:id"]).all((req, res, next) => {
	if (!req.session.is_trainer) {
		return res.send({
			error: "Vous n'avez pas accès à cette ressource"
		});
	}

	if (!req.body.id_trainer) {
		req.body.id_trainer = req.session.user_id;
	}

	req.where = Object.assign({ id_trainer: req.body.id_trainer }, req.where);
	req.query = Object.assign({ id_trainer: req.body.id_trainer }, req.query);

	next();
});

router.route("/user_package").all((req, res, next) => {
	if (req.query.id && !req.session.is_trainer) {
		return res.send({
			error: "Vous n'avez pas accès à cette ressource"
		});
	}

	next();
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
			res.send({
				error: err.message || err
			});
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
			res.send({
				error: err.message || err
			});
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
			AND 	s.date > current_timestamp()
			ORDER BY s.date ASC`,
				[req.session.user_id],
				null,
				true
			);

			res.send(reservation.result);
		} catch (err) {
			res.send({
				error: err.message || err
			});
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

			next();
		} catch (err) {
			res.send({
				error: err.message || err
			});
		}
	})
	.put(async (req, res, next) => {
		try {
			if (req.body.enabled === 0) {
				const user_package = await getUserPackageFromIdReservation(req.params.id);

				if (user_package && user_package.usage > 0) {
					await backend.put({
						table: "user_package",
						where: {
							id: user_package.id
						},
						body: {
							usage: user_package.usage - 1
						}
					});
				}
			}
		} catch (err) {
			console.log(err);
		}
		next();
	});

router
	.route("/slot")
	.get(async (req, res) => {
		try {
			const slots = await backend.handleQuery(
				`SELECT 
				s.id,
				s.date,
				a.label,
				a.spots,
				r.id_dog,
				r.id id_reservation,
                CASE WHEN d.breed != "" THEN concat(d.label, ' (', d.breed, ' ', d.sexe, ')') ELSE concat(d.label, " *") END label_dog
				
			FROM slot s
			JOIN activity a on a.id = s.id_activity
			LEFT JOIN reservation r on r.id_slot = s.id and r.enabled = 1
            LEFT JOIN dog d on d.id = r.id_dog

			WHERE	s.id_trainer = ?
			AND 	s.date > current_timestamp()
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
						label: slot.label_dog
					});

					results[slot.id].reservations += 1;
					const full = results[slot.id].reservations >= results[slot.id].spots;

					results[slot.id].label = `${full ? "Complet" : `${results[slot.id].reservations} / ${slot.spots}`}`;
				}
			});

			res.send(
				Object.values(results).sort((a, b) => {
					return a.date > b.date ? 1 : -1;
				})
			);
		} catch (err) {
			res.send({
				error: err.error || err
			});
		}
	})
	.put(async (req, res, next) => {
		try {
			// TODO handle refund here
		} catch (err) {}
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
		res.send({
			error: err.error || err
		});
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
				.map(user => {
					user.label = `<a href="tel:${user.phone}"><i class="fa-solid fa-phone"></i></a> ${user.firstname} ${user.lastname} <a href="mailto:${user.email}" target="_blank">&lt;${user.email}&gt;</a>`;
					user.dogs = dogByUser[user.id];
					return user;
				})
				.filter(user => user.id !== 2)
		);
	} catch (err) {
		res.send({
			error: err.error || err
		});
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
		res.send({
			error: err.message || error
		});
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
			res.send({
				error: err.error || err
			});
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
		res.send({
			error: err.error || err
		});
	}
});

const Private = _backend => {
	backend = _backend;
	return router;
};

export { Private };
