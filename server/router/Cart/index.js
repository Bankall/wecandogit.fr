import { Router } from "express";
import { Stripe } from "stripe";
import { errorHandler } from "../../lib/utils.js";
import MailSender from "../../lib/mail-sender/index.cjs";

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

		let cantAddMore = false;

		const cartItem = {
			type: req.body.type,
			id: req.body.id,
			id_cart_item: parseInt(Math.random() * 1000000, 10)
		};

		if (req.session.user_id) {
			const dogs = await backend.get({
				table: "dog",
				query: {
					id_user: req.session.user_id
				}
			});

			if (dogs.result.length) {
				const dogIds = dogs.result.map(dog => dog.id).join(",");
				const alreadyInCart = req.session.cart.filter(item => item.type === cartItem.type && item.id === cartItem.id).length;
				const bookings = await backend.get({ table: "reservation", query: { id_slot: cartItem.id, id_dog: dogIds, enabled: 1 } });
				const alreadyBookedIds = bookings.result.length ? bookings.result.map(booking => booking.id_dog) : [];

				if (req.session.cart.length) {
					req.session.cart.forEach(item => {
						if (item.type === cartItem.type && item.id === cartItem.id && item.id_dog) {
							alreadyBookedIds.push(item.id_dog);
						}
					});
				}

				const nextAvailableDog = dogs.result.filter(dog => !alreadyBookedIds.includes(dog.id));
				if (!nextAvailableDog.length) {
					throw { message: "Vous avez déjà réservé ce créneau" };
				}

				cartItem.id_dog = nextAvailableDog[0].id;

				if (dogs.result.length === alreadyInCart + 1 + alreadyBookedIds.length) {
					cantAddMore = true;
				}
			}
		}

		req.session.cart.push(cartItem);
		res.send({
			ok: true,
			cantAddMore
		});
	} catch (err) {
		errorHandler({ err, req, res });
	}
});

router
	.route("/:id_cart_item/:type/:id/:id_dog")
	.put((req, res) => {
		try {
			if (!req.session.cart) {
				throw "Panier vide";
			}

			req.session.cart = req.session.cart.map(item => {
				try {
					if (item.id_cart_item === parseInt(req.params.id_cart_item, 10)) {
						if (req.body.payment_type) {
							item.payment_type = req.body.payment_type;
						}

						if (req.body.id_dog) {
							item.id_dog = parseInt(req.body.id_dog, 10);
						}
					}
				} catch (err) {
					errorHandler({ err, req });
				}

				return item;
			});

			res.send({ ok: true });
		} catch (err) {
			errorHandler({ err, req, res });
		}
	})
	.delete((req, res) => {
		try {
			req.session.cart = req.session.cart.filter(item => {
				if (item.id_cart_item === parseInt(req.params.id_cart_item, 10)) {
					return false;
				}

				return true;
			});

			res.send({ ok: true });
		} catch (err) {
			errorHandler({ err, req, res });
		}
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
				id_user: req.session.user_id || 0
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
		errorHandler({ err, req, res });
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
		if (!req.session.cart || !req.session.cart.length) {
			return {};
		}

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
			data.id_dog = item.id_dog || (dog.result && dog.result.length ? dog.result[0].id : 0);
			data.id_cart_item = item.id_cart_item;

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

		for (const row in byTrainers) {
			const trainer = byTrainers[row];
			const VATApplicable = trainers.result.find(t => t.id === trainer.id)?.vat_applicable;

			if (VATApplicable) {
				trainer.tax_excluded = parseFloat((trainer.total / 1.2).toFixed(2));
				trainer.vat = parseFloat((trainer.total - trainer.tax_excluded).toFixed(2));
			}
		}

		return byTrainers;
	} catch (err) {
		errorHandler({ err, req });
		return err;
	}
};

const isValidAddress = user => {
	return user && user.address && user.postal_code && user.city && user.address.trim() !== "" && user.postal_code.trim() !== "" && user.city.trim() !== "";
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

		if (req.session.user_id) {
			const user = await backend.get({
				table: "user",
				id: req.session.user_id
			});

			if (!isValidAddress(user.result)) {
				notice.has_address = false;
			}
		}

		const byTrainers = await sortCartItemByTrainers(req);
		res.send({
			result: Object.values(byTrainers),
			notice
		});
	} catch (err) {
		errorHandler({ err, req, res });
	}
});

router.route("/checkout/:idTrainer").get(async (req, res) => {
	try {
		const allCartItems = await sortCartItemByTrainers(req);
		const cartItems = allCartItems[req.params.idTrainer].slot.concat(allCartItems[req.params.idTrainer].package);

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
			success_url: `${config.get("BACK_URI")}/api/v1/cart/payment/success/${req.params.idTrainer}/{CHECKOUT_SESSION_ID}`,
			line_items: lineItems,
			automatic_tax: {
				enabled: true
			},
			mode: "payment"
		});

		req.session.stripe_session_id = session.id;
		req.session.stripe_session_cart = cartItems;

		await handleReservation(req, req.session.stripe_session_cart, session.id);
		await backend.post({
			table: "payment_activity",
			body: {
				session_id: session.id,
				id_user: req.session.user_id,
				id_trainer: req.params.idTrainer,
				details: JSON.stringify(cartItems)
			}
		});

		req.session.stripe_session_url = session.url;
		res.redirect(`${config.get("FRONT_URI")}/cart/success/${req.params.idTrainer}/${session.id}/`);
	} catch (err) {
		errorHandler({ err, req, res });
	}
});

router.route("/stripe-redirect/:id_trainer/:session_id").get(async (req, res) => {
	const trainer = await backend.get({
		table: "user",
		query: {
			id: req.params.id_trainer
		}
	});

	const stripe_sk = trainer.result.length ? trainer.result[0].stripe_sk : null;
	const session = await Stripe(stripe_sk).checkout.sessions.retrieve(req.params.session_id);

	res.redirect(303, session.url || req.session.stripe_session_url);
});

const handleReservation = async (req, itemToReserve, stripe_id) => {
	try {
		for await (const item of itemToReserve) {
			let package_usage = 0;

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
						package_usage = current_usage.result.usage + 1;

						await backend.put({
							table: "user_package",
							where: {
								id: item.payment_type
							},
							body: {
								usage: package_usage
							}
						});
					} else {
						return { error: `Vous avez dépassez le nombre d'utilisation de votre formule ${_package.result.label}` };
					}
				}

				if (parseInt(item.payment_type, 10).toString() === item.payment_type) {
					item.payment_type = parseInt(item.payment_type, 10);
				}

				const reservation = await backend.post({
					table: "reservation",
					body: {
						id_slot: item.id,
						id_dog: item.id_dog,
						paid: !["direct", "later"].includes(item.payment_type),
						payment_type: typeof item.payment_type === "number" ? "package" : item.payment_type,
						payment_details: typeof item.payment_type === "number" ? item.payment_type : stripe_id
					}
				});

				item.reservation_id = reservation.result.id;

				await backend.notify({
					who: req.session.user_id,
					action: "booked",
					what: "slot",
					how: item.payment_type,
					id_what: item.id,
					package_usage,
					detail_what: item.reservation_id
				});
			}

			if (item.type === "package") {
				const user_package = await backend.post({
					table: "user_package",
					body: {
						id_package: item.id,
						id_user: req.session.user_id,
						paid: !["direct", "later"].includes(item.payment_type),
						payment_type: item.payment_type,
						payment_details: stripe_id
					}
				});

				item.package_id = user_package.result.id;

				await backend.notify({
					who: req.session.user_id,
					action: "booked",
					what: "package",
					how: item.payment_type,
					id_what: item.id,
					detail_what: item.package_id
				});
			}
		}

		req.session.cart = req.session.cart.filter(item => !itemToReserve.some(paid_item => paid_item.id === item.id && paid_item.type === item.type));
		req.session.item_to_pay = itemToReserve.filter(item => item.payment_type === "direct");

		const user = await backend.get({
			table: "user",
			id: req.session.user_id
		});

		const content = `<p>Bonjour ${user.result.firstname},</p>
		<p>Nous vous confirmons ${itemToReserve.length > 1 ? "vos réservations" : "votre réservation"}, voici le détail:</p>
		<p>
			<ul>
				${itemToReserve.map(item => `<li>${item.label} - Paiement: ${typeof item.payment_type === "number" ? "Formule" : item.payment_type === "direct" ? "En ligne" : "En personne"}</li>`).join("")}
			</ul>
		</p>
		<p></p>
		<p>A bientôt !</p>
		<br/><br/>
		<p style='color: #ED4337;'>Attention, pour tout créneau au parc de loisirs, merci de laisser vos chiens patienter dans votre voiture jusqu'à ce que l'on vienne vous chercher pour votre activité, et de ne pas les promener sur le parking ni à proximité du jardin de nos voisins.</p>`;

		await MailSender.send({
			subject: "Confirmation de commande",
			email: user.result.email,
			macros: {
				PRE_HEADER: "C'est reservé !",
				CONTENT_HTML: content,
				EMAIL_TYPE: "reminder",
				EMAIL: user.result.email
			}
		});

		return true;
	} catch (err) {
		errorHandler({ err, req });
		return false;
	}
};

router.route("/payment/success/:id_trainer/:session_id").all(async (req, res) => {
	try {
		const trainer = await backend.get({
			table: "user",
			query: {
				id: req.params.id_trainer
			}
		});

		const stripe_sk = trainer.result.length ? trainer.result[0].stripe_sk : null;

		if (!stripe_sk) {
			throw "Payment non configuré";
		}

		const stripe = Stripe(stripe_sk);
		const session = await stripe.checkout.sessions.retrieve(req.params.session_id);

		await backend.post({
			table: "payment_history",
			body: {
				session_id: session.id,
				payment_intent: session.payment_intent,
				amount: session.amount_total,
				id_user: req.session.user_id,
				id_trainer: req.params.id_trainer,
				status: session.status,
				details: JSON.stringify(req.session.stripe_session_cart)
			}
		});

		if (session.status !== "complete" || session.payment_status !== "paid") {
			return res.redirect("/cart#payment-error");
		}

		for await (const item of req.session.item_to_pay) {
			if (item.type === "slot") {
				await backend.put({
					table: "reservation",
					id: item.reservation_id,
					body: {
						paid: 1,
						payment_details: session.id
					}
				});
			}

			if (item.type === "package") {
				await backend.put({
					table: "user_package",
					id: item.package_id,
					body: {
						paid: 1,
						payment_details: session.id
					}
				});
			}

			req.session.item_to_pay = [];
		}

		res.redirect(config.get("FRONT_URI") + (req.session.cart.length ? "/cart" : "/account"));
	} catch (err) {
		errorHandler({ err, req, res });
	}
});

router.route("/make-reservation/:idTrainer").get(async (req, res) => {
	try {
		const allCartItems = await sortCartItemByTrainers(req);
		if (!allCartItems[req.params.idTrainer]) {
			throw {
				error: "Can't handle an empty cart",
				idTrainer: req.params.idTrainer,
				allCartItems
			};
		}

		const cartItems = (allCartItems[req.params.idTrainer].slot || []).concat(allCartItems[req.params.idTrainer].package);
		const allReserved = await handleReservation(req, cartItems);

		res.redirect(config.get("FRONT_URI") + (req.session.cart.length ? "/cart" + (allReserved.error ? "#" + allReserved.error : "") : "/account"));
	} catch (err) {
		errorHandler({ err, req });
		return false;
	}
});

const Cart = _backend => {
	backend = _backend;
	return router;
};

export { Cart };
