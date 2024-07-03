import { Router } from "express";
import { Stripe } from "stripe";
import config from "config";

let backend;

const router = Router();
router.route("/ping").get((req, res) => {
	res.send("pong");
});

router.route("/count").get(async (req, res) => {
	const count = req.session.cart ? req.session.cart.length : 0;
	res.send({ count });
});

router.route("/add").post(async (req, res) => {
	try {
		if (!req.session.cart) {
			req.session.cart = [];
		}

		req.session.cart.push({
			type: req.body.type,
			id: req.body.id
		});

		res.send({
			ok: true
		});
	} catch (err) {
		res.send({
			error: err.error || err
		});
	}
});

router.route("/:type/:id").put((req, res) => {
	req.session.cart = req.session.cart.map(item => {
		if (item.type === req.params.type && item.id === parseInt(req.params.id, 10)) {
			item.paid_later = req.body.paid_later;
		}

		return item;
	});

	res.send({ ok: true });
});

const getPackageDetail = async _package => {
	try {
		const data = await backend.get({
			table: "package",
			id: _package.id
		});

		return { label: data.result.label, price: data.result.price, id_trainer: data.result.id_trainer };
	} catch (err) {
		return err;
	}
};

const getSlotDetail = async slot => {
	try {
		const data = await backend.handleQuery(
			`
				SELECT
					a.label,
					a.price,
					a.id_trainer
				FROM activity a
				JOIN slot s on s.id_activity = a.id
				WHERE s.id = ?
			`,
			[slot.id],
			"get-activity",
			false
		);

		return { label: data.result.label, price: data.result.price, id_trainer: data.result.id_trainer };
	} catch (err) {
		return err;
	}
};

const getCartItemDetail = async item => {
	try {
		switch (item.type) {
			case "package":
				return await getPackageDetail(item);
			case "slot":
				return await getSlotDetail(item);
			default:
				throw { error: "Produit inconnu dans le panier" };
		}
	} catch (err) {
		return err;
	}
};

const sortCartItemByTrainers = async cart => {
	try {
		const byTrainers = {};
		const trainers = await backend.get({
			table: "user",
			query: {
				is_trainer: 1
			}
		});

		for (const item of cart) {
			const data = await getCartItemDetail(item);

			if (!byTrainers[data.id_trainer]) {
				byTrainers[data.id_trainer] = {
					firstname: trainers.result.filter(trainer => trainer.id === data.id_trainer)[0].firstname,
					id: data.id_trainer,
					package: [],
					slot: [],
					total: 0
				};
			}

			data.type = item.type;
			data.id = item.id;
			data.paid_later = item.paid_later;

			byTrainers[data.id_trainer][item.type].push(data);

			if (!data.paid_later) {
				byTrainers[data.id_trainer].total += data.price;
			}
		}

		return byTrainers;
	} catch (err) {
		return err;
	}
};

router.route("/full-cart").get(async (req, res) => {
	try {
		console.log(req.session);
		if (!req.session.cart || !req.session.cart.length) {
			return res.send({ result: [] });
		}
		const dog = await backend.get({
			table: "dog",
			query: {
				id_user: req.session.user_id || 0
			}
		});

		const notice = {};
		if (!req.session.user_id) {
			notice.is_logged_in = false;
		}

		if (!dog.result.length) {
			notice.has_dog = false;
		}

		const byTrainers = await sortCartItemByTrainers(req.session.cart);
		res.send({
			result: Object.values(byTrainers),
			notice
		});
	} catch (err) {
		res.send({
			error: err.error || err
		});
	}
});

router.route("/checkout/:idTrainer").get(async (req, res) => {
	try {
		const allCartItems = await sortCartItemByTrainers(req.session.cart);
		const cartItems = allCartItems[req.params.idTrainer].slot.concat(allCartItems[req.params.idTrainer].package);

		const stripe = Stripe("sk_test_51PTk8U07NsxLzejoe3shNAKsm0HWKUyfSaoEZCl4H887Y4gnc0W7F7b2yYr3YFlo7jWDayVdgDY62kmDO6dtKt6P00UYq3vfvb");
		const session = await stripe.checkout.sessions.create({
			success_url: `${config.get("FRONT_URI")}/checkout/make-reservation`,
			line_items: [
				{
					price: "price_1MotwRLkdIwHu7ixYcPLm5uZ",
					quantity: 2
				}
			],
			mode: "payment"
		});
	} catch (err) {
		console.log(err);
		res.send({ error: err.message || err });
	}
});

const Cart = _backend => {
	backend = _backend;
	return router;
};

export { Cart };
