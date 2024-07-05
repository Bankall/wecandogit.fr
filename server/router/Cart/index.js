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

router
	.route("/:type/:id")
	.put((req, res) => {
		req.session.cart = req.session.cart.map(item => {
			if (item.type === req.params.type && item.id === parseInt(req.params.id, 10)) {
				item.paid_later = req.body.paid_later;
			}

			return item;
		});

		res.send({ ok: true });
	})
	.delete((req, res) => {
		req.session.cart = req.session.cart.filter(item => {
			if (item.type === req.params.type && item.id === parseInt(req.params.id, 10)) {
				return false;
			}

			return true;
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
					s.id_trainer
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

const sortCartItemByTrainers = async req => {
	try {
		const byTrainers = {};
		const trainers = await backend.get({
			table: "user",
			query: {
				is_trainer: 1
			}
		});

		const dog = await backend.get({
			table: "dog",
			query: {
				id_user: req.session.user_id || 0
			}
		});

		for (const item of req.session.cart) {
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
			data.id_dog = dog.result[0].id;

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

		const byTrainers = await sortCartItemByTrainers(req);
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
		const allCartItems = await sortCartItemByTrainers(req);
		const cartItems = allCartItems[req.params.idTrainer].slot.concat(allCartItems[req.params.idTrainer].package);
		const lineItems = cartItems.map(item => {
			return {
				price_data: {
					currency: "EUR",
					product_data: {
						name: item.label
					},
					unit_amount: item.price * 100
				},
				quantity: 1
			};
		});

		const trainer = await backend.get({
			table: "user",
			query: {
				id: req.params.idTrainer
			}
		});

		const stripe_sk = trainer.result.length ? trainer.result[0].stripe_sk : null;

		if (!stripe_sk) {
			throw "Payment non configuré";
		}

		const stripe = Stripe(stripe_sk);
		const session = await stripe.checkout.sessions.create({
			success_url: `${config.get("BACK_URI")}/api/v1/cart/payment/success/${req.params.idTrainer}`,
			line_items: lineItems,
			mode: "payment"
		});

		req.session.stripe_session_id = session.id;
		req.session.stripe_session_cart = cartItems;

		res.redirect(303, session.url);
	} catch (err) {
		console.log(err);
		res.send({ error: err.message || err });
	}
});

const handleReservation = async (req, itemToReserve) => {
	try {
		for await (const item of itemToReserve) {
			if (item.type === "slot") {
				await backend.post({
					table: "reservation",
					body: {
						id_slot: item.id,
						id_dog: item.id_dog,
						paid: !item.paid_later
					}
				});
			}
		}

		req.session.cart = req.session.cart.filter(item => !itemToReserve.some(paid_item => paid_item.id === item.id && paid_item.type === item.type));

		return true;
	} catch (err) {
		console.error(err);
		return false;
	}
};

router.route("/payment/success/:idTrainer").all(async (req, res) => {
	try {
		const trainer = await backend.get({
			table: "user",
			query: {
				id: req.params.idTrainer
			}
		});

		const stripe_sk = trainer.result.length ? trainer.result[0].stripe_sk : null;

		if (!stripe_sk) {
			throw "Payment non configuré";
		}

		const stripe = Stripe(stripe_sk);
		const session = await stripe.checkout.sessions.retrieve(req.session.stripe_session_id);

		if (session.status !== "complete" || session.payment_status !== "paid") {
			return res.redirect("/cart#payment-error");
		}

		await handleReservation(req, req.session.stripe_session_cart);

		res.redirect(config.get("FRONT_URI") + (req.session.cart.length ? "/cart" : "/account"));
	} catch (e) {}
});

const Cart = _backend => {
	backend = _backend;
	return router;
};

export { Cart };
