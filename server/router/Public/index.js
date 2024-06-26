import { Router } from "express";
import { shuffle } from "../../lib/utils.js";

let backend;

const router = Router();
router.route("/ping").get((req, res) => {
	res.send("pong");
});

router.route("/is-logged-in").get((req, res) => {
	res.send({
		ok: !!(req.session && req.session.user_id)
	});
});

router.route("/update-user").put(async (req, res, next) => {
	try {
		await backend.put({
			table: "user",
			id: req.session.user_id,
			body: req.body
		});

		res.send({
			ok: true
		});
	} catch (err) {
		res.send({
			error: err.error
		});
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
		res.send({
			error: err.error
		});
	}
});

router.route("/get-cart-item").get(async (req, res) => {
	const count = parseInt(Math.random() * 3);
	res.send({ count });
});

router.route("/get-activities-by-trainer").get(async (req, res) => {
	try {
		const activities = await backend.get({
			table: "activity",
			query: {
				is_public: 1
			}
		});

		const trainers = await backend.get({
			table: "user",
			query: {
				is_trainer: 1
			}
		});

		if (!activities.result?.length || !trainers.result?.length) {
			throw { error: "Aucune activitée disponible" };
		}

		const resultByTrainers = {};

		trainers.result.forEach(trainer => {
			const { id, firstname } = trainer;
			resultByTrainers[id] = { id, name: firstname, activities: [] };
		});

		activities.result.forEach(({ id, id_trainer, label }) => {
			if (!resultByTrainers[id_trainer]) return;

			resultByTrainers[id_trainer].activities.push({ id, label });
		});

		res.send({
			result: shuffle(Object.values(resultByTrainers).filter(trainer => !!trainer.activities.length))
		});
	} catch (err) {
		res.send({
			error: err.error
		});
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
	INNER JOIN user u on u.id = a.id_trainer
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
		res.send({
			error: err.error || err
		});
	}
});

router.route("/get-next-individual-slots").get(async (req, res) => {
	try {
		const slots = await backend.handleQuery(getNextSlotsQuery, [0], "get-slot", true);

		res.send({
			result: slots.result
		});
	} catch (err) {
		res.send({
			error: err.error || err
		});
	}
});

router.route("/get-all-slots").get(async (req, res) => {
	try {
		const slots = await backend.handleQuery(
			`
				SELECT 
					a.label,
					u.firstname,
					s.date,
					a.duration,
					s.id,
					a.spots
				FROM slot s
				INNER JOIN activity a on a.id = s.id_activity
				INNER JOIN user u on u.id = a.id_trainer
					WHERE	a.is_public = 1
					AND 	s.date > CURRENT_TIMESTAMP()

				ORDER BY date asc`,
			null,
			"get-slot",
			true
		);

		res.send(slots);
	} catch (err) {
		res.send({
			error: err.error || err
		});
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
					activites: []
				};
			}
			activity_group[group_label].activites.push(activity);
		});

		res.send({
			result: shuffle(Object.values(activity_group))
		});
	} catch (err) {
		res.send({
			error: err.error || err
		});
	}
});

router.route("/get-trainers-description").get(async (req, res) => {
	const trainers = [
		{
			id: 123,
			name: "Chloe Ternier",
			description: `Après avoir été infirmière pendant près de 10 ans, j'ai choisi de changer de voie pour m'investir dans le bien-être canin. Passionnée de sport (course à pied et triathlon), je suis persuadée que la pratique des sports canins peut permettre d'améliorer grandement non seulement la relation humain/chien, mais également aider à résoudre de nombreux troubles du comportement chez le chien.
	
	J'ai également conscience que de nombreux propriétaires ont besoin d'être guidés dans l'éducation de leur chien, d'apprendre à communiquer avec lui, à répondre à ses besoins. Mais aussi du fait que ces propriétaires sont de plus en plus soucieux du bien-être de leur animal.  J'ai donc débuté ma formation de cynologiste en septembre 2020, avant de quitter mon poste à l'hôpital au mois de juillet suivant afin de me consacrer entièrement à cette reconversion et à ce projet.
	
	J'ai obtenu mon diplôme de Cynologiste en juillet 2022.`,
			photo: "/assets/medias/chloe.jpg"
		},
		{
			id: 345,
			name: "Elodie Decouleur",
			description: `J'ai été commerciale durant 8 ans, avant d'être pendant 2 ans chef de publicité. En septembre 2020, j'ai décidé d'arrêter mon activité salariée, afin de me consacrer pleinement à mon activité secondaire, l'éducation et la rééducation des chiens de compagnie.
	
	Je suis passionnée de chiens depuis toujours, mais c'est en 2016 que j'ai validé le diplôme d'éducatrice comportementaliste, Cynologiste et que j'ai ouvert Amity Dog.
	
	J'accompagne depuis les familles et les associations de protection animale, en les aidant à mieux comprendre les chiens.`,
			photo: "/assets/medias/FB_IMG_1599744511817.jpg"
		}
	];

	res.send({
		trainers: shuffle(trainers)
	});
});

const Public = _backend => {
	backend = _backend;
	return router;
};

export { Public };
