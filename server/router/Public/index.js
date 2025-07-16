import { Router } from "express";
import { shuffle, errorHandler } from "../../lib/utils.js";
import axios from "axios";

let backend;

const router = Router();
router.route("/ping").get((req, res) => {
	res.send("pong");
});

router.route("/get-current-version").get((req, res) => {
	try {
		require("child_process").exec("git rev-parse HEAD", function (err, stdout) {
			res.send({
				version: stdout
			});
		});
	} catch (err) {
		errorHandler({ err, req, res });
	}
});

router.route("/log-error").post(async (req, res) => {
	req.originalUrl = req.body.originalUrl || "FrontErrorLogger";

	errorHandler({
		err: req.body.error,
		req
	});
});

router.route("/is-logged-in").get((req, res) => {
	res.send({
		ok: !!(req.session && req.session.user_id)
	});
});

router.route("/update-user/:id?").put(async (req, res, next) => {
	try {
		const { id } = req.params;
		if (id && !req.session.is_trainer) {
			throw { error: "You are not allowed to update another user" };
		}

		await backend.put({
			table: "user",
			id: id || req.session.user_id,
			body: req.body
		});

		res.send({
			ok: true
		});
	} catch (err) {
		errorHandler({ err, req, res });
	}
});

router.route("/user/:id").get(async (req, res, next) => {
	try {
		if (!req.session.is_trainer) {
			throw { error: "You are not allowed to get another user" };
		}

		const { id } = req.params;
		const data = await backend.get({
			table: "user",
			query: {
				id
			}
		});

		delete data.result[0].password;

		res.send({
			ok: true,
			result: data.result[0]
		});
	} catch (err) {
		errorHandler({ err, req, res });
	}
});

router.route("/me").get(async (req, res) => {
	try {
		const data = await backend.get({
			table: "user",
			query: {
				id: req.session.user_id
			}
		});

		if (!data.result.length) {
			throw { error: "Could not find user data" };
		}

		delete data.result[0].password;

		res.send({
			ok: true,
			result: data.result[0]
		});
	} catch (err) {
		errorHandler({ err, req, res });
	}
});

const getNextSlotsQuery = `
	SELECT 
		a.label,
		u.firstname,
		s.date,
		s.id
	FROM slot s
	INNER JOIN activity a on a.id = s.id_activity
	INNER JOIN user u on u.id = s.id_trainer
		WHERE	a.is_public = 1
		AND 	a.is_collective = ?
		AND 	s.date > CURRENT_TIMESTAMP()

	ORDER BY date asc
	LIMIT 5
`;

router.route("/get-next-collective-slots").get(async (req, res) => {
	try {
		const slots = await backend.handleQuery(getNextSlotsQuery, [1], "get-slot", true);

		res.send({
			result: slots.result
		});
	} catch (err) {
		errorHandler({ err, req, res });
	}
});

router.route("/get-next-individual-slots").get(async (req, res) => {
	try {
		const slots = await backend.handleQuery(getNextSlotsQuery, [0], "get-slot", true);

		res.send({
			result: slots.result
		});
	} catch (err) {
		errorHandler({ err, req, res });
	}
});

router.route("/get-all-slots").get(async (req, res) => {
	try {
		const dogs = await backend.get({
			table: "dog",
			query: {
				id_user: req.session.user_id || 0
			}
		});

		const myDogs = dogs.result.length;
		const slots = await backend.handleQuery(
			`
				SELECT 
					a.label,
					u.id id_trainer,
					u.firstname,
					s.date,
					a.duration,
					s.id id_slot,
					a.spots,
					case
                    when (select id from waiting_list where id_slot = s.id and id_user = ? and declined = 0 limit 1) is not null then 1 end waiting
				FROM slot s
				INNER JOIN activity a on a.id = s.id_activity
				INNER JOIN user u on u.id = s.id_trainer
				
				WHERE 	s.date > CURRENT_TIMESTAMP()
				AND 	s.enabled = 1
				
				ORDER BY date asc`,
			[req.session.user_id || 0],
			"get-slot",
			true
		);

		const reservations = await backend.handleQuery(
			`
			SELECT
				r.id,
				u.id id_user,
				s.id id_slot,
				d.label dog,
                CASE 
                WHEN (d.breed IS NOT NULL AND d.sexe IS NOT NULL) THEN
					concat(d.label, ' (', d.breed, ' ', d.sexe, ')')
				else 
					d.label
				end label
			FROM reservation r 
			JOIN slot s on s.id = r.id_slot
			JOIN dog d on d.id = r.id_dog
			JOIN user u on u.id = d.id_user
			WHERE s.date > CURRENT_TIMESTAMP()
			AND r.enabled = 1

			GROUP BY 1, 2, 3`,
			null,
			"get-slot",
			true
		);

		const reservationBySlot = {};
		if (reservations.result.length) {
			reservations.result.forEach(reservation => {
				if (!reservationBySlot[reservation.id_slot]) {
					reservationBySlot[reservation.id_slot] = {
						reservations: [],
						reserved: false
					};
				}

				reservationBySlot[reservation.id_slot].reservations.push(reservation.label);
				if (reservation.id_user === req.session.user_id) {
					if (!reservationBySlot[reservation.id_slot].reserved) {
						reservationBySlot[reservation.id_slot].reserved = [];
					}

					reservationBySlot[reservation.id_slot].reserved.push(reservation.label);
					reservationBySlot[reservation.id_slot].number_of_dogs = reservation.number_of_dogs;
				}
			});
		}

		const getEndDate = (date, duration) => {
			const endDate = new Date(date);
			endDate.setMinutes(endDate.getMinutes() + duration);

			return endDate.toISOString();
		};

		const slotsByIdTrainerAndTime = {};
		slots.result.forEach(slot => {
			if (typeof slotsByIdTrainerAndTime[slot.id_trainer + slot.date] === "undefined") {
				slotsByIdTrainerAndTime[slot.id_trainer + slot.date] = 0;
			}

			if (reservationBySlot[slot.id_slot] && reservationBySlot[slot.id_slot].reservations.length && slot.spots === 1) {
				slotsByIdTrainerAndTime[slot.id_trainer + slot.date]++;
			}

			if (typeof slotsByIdTrainerAndTime[slot.id_trainer + getEndDate(slot.date, slot.duration)] === "undefined") {
				slotsByIdTrainerAndTime[slot.id_trainer + getEndDate(slot.date, slot.duration)] = 0;
			}

			if (reservationBySlot[slot.id_slot] && reservationBySlot[slot.id_slot].reservations.length && slot.spots === 1) {
				slotsByIdTrainerAndTime[slot.id_trainer + getEndDate(slot.date, slot.duration)]++;
			}
		});

		slots.result = slots.result.map(slot => {
			slot.reservations = (reservationBySlot[slot.id_slot] || {}).reservations;
			slot.cantBeReserved = reservationBySlot[slot.id_slot] ? reservationBySlot[slot.id_slot].reserved.length >= myDogs : false;
			slot.is_mine = slot.id_trainer === req.session.user_id;

			return slot;
		});

		slots.result = slots.result.filter(slot => {
			if (slot.reservations && slot.reservations.length) {
				return true;
			}

			if (slotsByIdTrainerAndTime[slot.id_trainer + slot.date] && slot.spots === 1) {
				return false;
			}

			if (slotsByIdTrainerAndTime[slot.id_trainer + getEndDate(slot.date, slot.duration)] && slot.spots === 1) {
				return false;
			}

			return true;
		});

		res.send(slots);
	} catch (err) {
		console.log(err);
		errorHandler({ err, req, res });
	}
});

router.route("/get-all-packages").get(async (req, res) => {
	try {
		const data = await backend.handleQuery(
			`SELECT 
				p.id,
				p.label,
				p.description,
				p.price,
				p.number_of_session,
				p.validity_period,
				a.id activity_id,
				a.label activity_label
				
			FROM package p 
			JOIN package_activity pa on pa.id_package = p.id
			JOIN activity a on a.id = pa.id_activity

			WHERE p.is_public = 1`,
			[],
			null,
			true
		);

		const result = {};
		data.result.forEach(item => {
			if (!result[item.id]) {
				result[item.id] = {
					id: item.id,
					label: item.label,
					description: item.description,
					price: item.price,
					number_of_session: item.number_of_session,
					validity_period: item.validity_period,
					activities: []
				};
			}

			result[item.id].activities.push({
				label: item.activity_label,
				id: item.activity_id
			});
		});

		res.send({
			result: shuffle(Object.values(result))
		});
	} catch (err) {
		errorHandler({ err, req, res });
	}
});

router.route("/get-all-activities").get(async (req, res) => {
	try {
		const activities = await backend.handleQuery(
			`
				SELECT 
					id,
					label,
					group_label,
					is_collective,
					spots,
					price,
					long_description,
					description,
					duration

				FROM activity a
				WHERE a.is_public = 1
			`,
			null,
			"get-activity",
			true
		);

		const activity_group = {};
		activities.result?.map(activity => {
			const group_label = activity.group_label.trim();

			if (!activity_group[group_label]) {
				activity_group[group_label] = {
					label: group_label,
					activities: []
				};
			}

			const alreadyExist = activity_group[group_label].activities.filter(item => item.label === activity.label).length;
			if (alreadyExist) {
				return;
			}

			activity_group[group_label].activities.push(activity);
		});

		res.send({
			result: shuffle(Object.values(activity_group))
		});
	} catch (err) {
		errorHandler({ err, req, res });
	}
});

router.route("/get-trainers-description").get(async (req, res) => {
	const trainers = [
		{
			id: 123,
			name: "Chloe Ternier",
			description: `Infirmière pendant presque 10 ans, j’ai ressenti le besoin de donner un nouveau sens à ma carrière en me tournant vers le bien-être animal. 

Sportive dans l’âme (course à pied, triathlon), je suis convaincue que les sports canins peuvent renforcer la relation humain-chien et apporter un réel mieux-être, tant physique qu’émotionnel.

En 2020, j’ai débuté ma formation de Cynologiste, que j’ai validée en juillet 2022. J’ai alors quitté mon poste à l’hôpital pour m’investir pleinement dans cette reconversion. 

Aujourd’hui, j’accompagne les humains soucieux du bien-être de leur chien, en leur donnant les clés pour mieux communiquer et répondre aux besoins de leur compagnon, dans la joie et la coopération.`,
			photo: "/assets/medias/chloe.jpg"
		},
		{
			id: 345,
			name: "Elodie Decouleur",
			description: `Après 8 ans comme commerciale puis 2 ans cheffe de publicité, j’ai décidé en 2020 de quitter le monde du salariat pour me consacrer entièrement à ce qui était jusqu’alors mon activité secondaire : l’éducation et la rééducation des chiens de compagnie.

Passionnée par les chiens depuis toujours, j’ai obtenu mon diplôme d’éducatrice comportementaliste – Cynologiste en 2016, et fondé Amity Dog dans la foulée. J’y ai accompagné de nombreuses familles et associations de protection animale, en parallèle de mon métier.

Aujourd’hui, je suis pleinement investie dans cette voie, avec l’envie profonde d’aider chaque binôme humain-chien à mieux se comprendre et à avancer ensemble, dans le respect, la confiance et la bienveillance.`,
			photo: "/assets/medias/FB_IMG_1599744511817.jpg"
		}
	];

	res.send({
		trainers: shuffle(trainers)
	});
});

const cachedReviews = {};
router.route("/get-reviews").get(async (req, res) => {
	try {
		if (cachedReviews.reviews) {
			return res.send(cachedReviews);
		}

		const { data } = await axios.get("https://places.googleapis.com/v1/places/ChIJ8yRNHrKz7iUReSJcT90Ok7w?key=AIzaSyDtFaGeGR5rB75OjS-F5M1ZQn8xmrxkrGo&fields=reviews", {
			headers: {
				Referer: "https://www.wecandogit.com/"
			}
		});

		cachedReviews.reviews = data.reviews;
		res.send(cachedReviews);
	} catch (err) {
		errorHandler({ err, req, res });
	}
});

router.route("/proxy/").get(async (req, res) => {
	try {
		const { url } = req.query;
		if (!url) {
			throw { error: "Missing URL parameter" };
		}

		if (!url.startsWith("https://lh3.googleusercontent.com")) {
			throw { error: "Invalid URL" };
		}

		const response = await axios.get(url, {
			headers: {
				Referer: "https://www.wecandogit.com/"
			},
			responseType: "arraybuffer"
		});

		res.setHeader("Content-Type", "image/png");
		res.end(response.data, "binary");
	} catch (err) {
		errorHandler({ err, req, res });
	}
});

router.route("/public-activity/:id").get(async (req, res) => {
	try {
		const { id } = req.params;
		const activity = await backend.get({
			table: "activity",
			id
		});

		res.send(activity.result);
	} catch (err) {
		errorHandler({ err, req, res });
	}
});

const Public = _backend => {
	backend = _backend;
	return router;
};

export { Public };
