import { Router } from "express";

let backend;

const router = Router();
router.route("/ping").get((req, res) => {
	res.send("pong");
});

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
	req.query = Object.assign({ id_trainer: req.body.id_trainer }, req.query);

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
	.route("/reservation")
	.get(async (req, res) => {
		try {
			const reservation = await backend.handleQuery(
				`SELECT 
				CONCAT(s.date, ' - ', a.label, ' - ', d.label) label,
				r.id

			FROM reservation r 
			JOIN slot s on s.id = r.id_slot
			JOIN activity a on a.id = s.id_activity
			JOIN dog d on d.id = r.id_dog
			JOIN user u on u.id = d.id_user
			WHERE 	u.id = ? 
			AND 	r.enabled = 1 
			AND 	s.enabled = 1
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
	});

router.route("/slot").get(async (req, res) => {
	try {
		const slots = await backend.handleQuery(
			`SELECT 
				s.id,
				s.date,
				a.label,
				a.spots,
				sum(case when r.enabled = 1 then 1 else 0 end) reservations
				
			FROM slot s
			JOIN activity a on a.id = s.id_activity
			LEFT JOIN reservation r on r.id_slot = s.id

			WHERE	s.id_trainer = ?
			AND 	s.date > current_timestamp()

			GROUP BY s.id
			ORDER BY s.date ASC`,
			[req.session.user_id],
			null,
			true
		);

		slots.result = slots.result.map(slot => {
			const full = slot.reservations >= slot.spots;
			slot.group_label = slot.label;
			slot.label = `${full ? "Complet" : `${slot.reservations} / ${slot.spots}`}`;

			return slot;
		});

		res.send(slots.result);
	} catch (err) {
		res.send({
			error: err.error
		});
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
		res.send({
			error: err.error
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

			dogByUser[dog.id_user].push(dog.label);
		});

		res.send(
			users.result
				.map(user => {
					user.label = `${user.firstname} ${user.lastname} / ${user.email} ${dogByUser[user.id] ? `\n${dogByUser[user.id].join(", ")}` : ""}`;
					return user;
				})
				.filter(user => user.id !== 2)
		);
	} catch (err) {
		console.log(err);
		res.send({
			error: err.error
		});
	}
});

router.route("/user_package").get(async (req, res) => {
	try {
		const user_packages = await backend.get({
			table: "user_package",
			query: {
				id_user: req.session.user_id
			}
		});

		for await (const user_package of user_packages.result) {
			const _package = await backend.get({
				table: "package",
				id: user_package.id_package
			});

			user_package.label = `${_package.result.label} - ${user_package.usage}/${_package.result.number_of_session}`;
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
		console.log(err);
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
