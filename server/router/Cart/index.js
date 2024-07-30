import { query, Router } from "express";
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
				if (req.body.payment_type) {
					item.payment_type = req.body.payment_type;
				}

				if (req.body.id_dog) {
					item.id_dog = parseInt(req.body.id_dog, 10);
				}
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

const getSlotDetail = async (req, slot) => {
	try {
		const data = await backend.handleQuery(
			`
				SELECT
					a.label,
					a.id id_activity,
					a.price,
					s.id_trainer,
					s.date
				FROM activity a
				JOIN slot s on s.id_activity = a.id
				WHERE s.id = ?
			`,
			[slot.id],
			"get-activity",
			false
		);

		const user_packages = await backend.getUserPackageForID({ id_slot: slot.id, available: true, req });
		const dogs = await backend.get({
			table: "dog",
			query: {
				id_user: req.session.user_id
			}
		});

		const date = new Date(data.result.date);
		const formattedDate = new Intl.DateTimeFormat("fr-FR", {
			day: "2-digit",
			month: "2-digit"
		}).format(date);

		return {
			label: `${data.result.label} - ${formattedDate}`,
			price: data.result.price,
			id_trainer: data.result.id_trainer,
			package_available: user_packages,
			dogs:
				dogs.result && dogs.result.length
					? dogs.result.map(dog => {
							return { label: dog.label, id: dog.id };
					  })
					: []
		};
	} catch (err) {
		console.log(err);
		return err;
	}
};

const getCartItemDetail = async (req, item) => {
	try {
		switch (item.type) {
			case "package":
				return await getPackageDetail(item);
			case "slot":
				return await getSlotDetail(req, item);
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
			const data = await getCartItemDetail(req, item);

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
			data.payment_type = item.payment_type;
			data.id_dog = item.id_dog || dog.result[0].id;

			if (data.package_available && data.package_available.length && !data.payment_type) {
				data.payment_type = data.package_available[0].id;
			}

			if (!data.payment_type) {
				data.payment_type = "direct";
			}

			byTrainers[data.id_trainer][item.type].push(data);

			if (data.payment_type === "direct" || !data.payment_type) {
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

		console.log(cartItems);

		const lineItems = cartItems
			.filter(item => item.payment_type === "direct")
			.map(item => {
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
		res.send({ error: err.message || err });
	}
});

const handleReservation = async (req, itemToReserve, stripe_id) => {
	try {
		for await (const item of itemToReserve) {
			if (item.type === "slot") {
				if (!["direct", "later"].includes(item.payment_type)) {
					const current_usage = await backend.get({
						table: "user_package",
						id: item.payment_type
					});

					const _package = await backend.get({
						table: "package",
						id: current_usage.result.id_package
					});

					if (current_usage.result.usage < _package.result.number_of_session) {
						await backend.put({
							table: "user_package",
							where: {
								id: item.payment_type
							},
							body: {
								usage: current_usage.result.usage + 1
							}
						});
					} else {
						return { error: `Vous avez dépassez le nombre d'utilisation de votre formule ${_package.result.label}` };
					}
				}

				if (parseInt(item.payment_type, 10).toString() === item.payment_type) {
					item.payment_type = parseInt(item.payment_type, 10);
				}

				await backend.post({
					table: "reservation",
					body: {
						id_slot: item.id,
						id_dog: item.id_dog,
						paid: item.payment_type !== "later",
						payment_type: typeof item.payment_type === "number" ? "package" : item.payment_type,
						payment_details: typeof item.payment_type === "number" ? item.payment_type : stripe_id
					}
				});
			}

			if (item.type === "package") {
				await backend.post({
					table: "user_package",
					body: {
						id_package: item.id,
						id_user: req.session.user_id,
						paid: item.payment_type !== "later",
						payment_type: item.payment_type,
						payment_details: stripe_id
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

		const allReserved = await handleReservation(req, req.session.stripe_session_cart, session.id);
		res.redirect(config.get("FRONT_URI") + (req.session.cart.length ? "/cart" + (allReserved.error ? "#" + allReserved.error : "") : "/account"));
	} catch (e) {}
});

router.route("/make-reservation/:idTrainer").get(async (req, res) => {
	try {
		const allCartItems = await sortCartItemByTrainers(req);
		const cartItems = allCartItems[req.params.idTrainer].slot.concat(allCartItems[req.params.idTrainer].package);

		const allReserved = await handleReservation(req, cartItems);
		res.redirect(config.get("FRONT_URI") + (req.session.cart.length ? "/cart" + (allReserved.error ? "#" + allReserved.error : "") : "/account"));
	} catch (err) {
		console.error(err);
		return false;
	}
});

const Cart = _backend => {
	backend = _backend;
	return router;
};

export { Cart };
