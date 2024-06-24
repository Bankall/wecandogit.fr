import { Router } from "express";

let backend;

const router = Router();
router.route("/ping").get((req, res) => {
	res.send("pong");
});

router.route(["/activity", "/slot", "/package"]).all((req, res, next) => {
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

router.route("/package/:id").put((req, res, next) => {
	const activities = req.body.activity;
	req.body.activity = Object.keys(activities)
		.filter(activity => !!activities[activity])
		.join(",");

	next();
});

router.route("/slot").get(async (req, res) => {
	try {
		const activities = await backend.get({
			table: "activity",
			query: {
				id_trainer: req.session.user_id
			}
		});

		const slots = await backend.get({
			table: "slot",
			query: {
				id_trainer: req.session.user_id
			}
		});

		for await (const slot of slots.result) {
			slot.label = `${activities.result.filter(activity => activity.id === slot.id_activity)[0].label} - ${new Date(slot.date).toLocaleString()}`;
		}

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

router.route("/dog/:id?").get(async (req, res, next) => {
	if (req.session.is_trainer) {
		return next();
	}

	const dog = await backend.get({
		table: "dog",
		query: {
			id: req.session.id
		}
	});

	if (dog.result?.user_id !== req.session.user_id) {
		return res.send({
			error: "Vous n'avez pas accès à cette ressource"
		});
	}

	next();
});

const Private = _backend => {
	backend = _backend;
	return router;
};

export { Private };
