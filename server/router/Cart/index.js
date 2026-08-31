import { Router } from "express";
import { errorHandler } from "../../lib/utils.js";
import MailSender from "../../lib/mail-sender/index.cjs";
import { getTrainerStripe } from "../../lib/stripe.js";
import { query } from "../../lib/db.js";
import { reserveSlot, confirmCheckoutSession, isPackagePayment } from "../../lib/booking.js";
import { verifyPaymentToken } from "../../lib/payment-link.js";

import config from "config";

let backend;

const router = Router();
router.route("/ping").get((req, res) => {
	res.send("pong");
});

// La session est mutée juste avant des redirections (Stripe fait immédiatement
// une nouvelle requête) : on force l'écriture en base avant de répondre.
const saveSession = req =>
	new Promise((resolve, reject) => {
		req.session.save(err => (err ? reject(err) : resolve()));
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
	const data = await backend.get({
		table: "package",
		id: _package.id
	});

	if (!data.result || !data.result.id) {
		return null;
	}

	// parseFloat : le driver MySQL renvoie les DECIMAL en chaîne, ce qui
	// transformait l'addition du total en concaténation
	return { label: data.result.label, price: parseFloat(data.result.price), id_trainer: data.result.id_trainer };
};

const getSlotDetail = async (req, slot) => {
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
			WHERE s.id = ? AND s.enabled = 1
		`,
		[slot.id],
		"get-activity",
		false
	);

	// Créneau supprimé ou désactivé entre l'ajout au panier et maintenant
	if (!data.result || !data.result.date) {
		return null;
	}

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
		price: parseFloat(data.result.price),
		id_trainer: data.result.id_trainer,
		package_available: user_packages,
		dogs:
			dogs.result && dogs.result.length
				? dogs.result.map(dog => {
						return { label: dog.label, id: dog.id };
					})
				: []
	};
};

const getCartItemDetail = async (req, item) => {
	try {
		switch (item.type) {
			case "package":
				return await getPackageDetail(item);
			case "slot":
				return await getSlotDetail(req, item);
			default:
				return null;
		}
	} catch (err) {
		errorHandler({ err, req });
		return null;
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

		// Crédits restants par formule, décomptés au fil du panier pour ne pas
		// affecter deux séances au même crédit (cause du bug de sur-réservation)
		const creditsLeft = {};
		const registerPackages = packages => {
			(packages || []).forEach(user_package => {
				if (typeof creditsLeft[user_package.id] === "undefined") {
					creditsLeft[user_package.id] = Math.max(0, user_package.number_of_session - user_package.usage);
				}
			});
		};

		const invalidItems = [];
		for (const item of req.session.cart) {
			const data = await getCartItemDetail(req, item);

			// Article devenu invalide (créneau supprimé...) : on le retire du panier
			// au lieu de casser toute la page
			if (!data || !data.id_trainer) {
				invalidItems.push(item.id_cart_item);
				continue;
			}

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

			registerPackages(data.package_available);

			if (isPackagePayment(data.payment_type)) {
				// Choix explicite d'une formule : vérifier qu'il reste un crédit non
				// déjà réclamé par un autre article du panier
				const id_user_package = parseInt(data.payment_type, 10);
				if (creditsLeft[id_user_package] > 0) {
					creditsLeft[id_user_package] -= 1;
				} else {
					data.payment_type = "later";
				}
			} else if (!data.payment_type && data.package_available && data.package_available.length) {
				const available = data.package_available.find(user_package => creditsLeft[user_package.id] > 0);

				if (available) {
					data.payment_type = available.id;
					creditsLeft[available.id] -= 1;
				}
			}

			if (!data.payment_type) {
				data.payment_type = "direct";
			}

			byTrainers[data.id_trainer][item.type].push(data);

			if (data.payment_type === "direct") {
				byTrainers[data.id_trainer].total += data.price;
			}
		}

		if (invalidItems.length) {
			req.session.cart = req.session.cart.filter(item => !invalidItems.includes(item.id_cart_item));
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
		return {};
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

const removeFromCart = (req, id_cart_item) => {
	req.session.cart = (req.session.cart || []).filter(item => item.id_cart_item !== id_cart_item);
};

/*
 * Réserve les articles du panier. Ne s'arrête jamais en cours de route : un
 * article qui échoue (formule épuisée, créneau complet...) est signalé dans
 * `warnings` et le reste du panier est traité normalement.
 */
const handleReservation = async (req, itemToReserve) => {
	const reserved = [];
	const warnings = [];

	for (const item of itemToReserve) {
		try {
			if (item.type === "slot") {
				const result = await reserveSlot({
					id_slot: item.id,
					id_dog: item.id_dog,
					payment_type: item.payment_type
				});

				if (result.unavailable || result.full || result.duplicate) {
					warnings.push(`${item.label} : ${result.duplicate ? "vous avez déjà réservé ce créneau" : result.full ? "le créneau est désormais complet" : "le créneau n'est plus disponible"}`);
					removeFromCart(req, item.id_cart_item);
					continue;
				}

				if (result.downgraded) {
					warnings.push(`${item.label} : plus de crédit disponible sur votre formule, la séance sera à régler sur place`);
				}

				item.payment_type = result.payment_type;
				item.reservation_id = result.id_reservation;

				await backend.notify({
					who: req.session.user_id,
					action: "booked",
					what: "slot",
					how: item.payment_type,
					id_what: item.id,
					package_usage: result.package_usage,
					dog: item.id_dog,
					detail_what: item.reservation_id
				});

				reserved.push(item);
				removeFromCart(req, item.id_cart_item);
			}

			if (item.type === "package") {
				const user_package = await backend.post({
					table: "user_package",
					body: {
						id_package: item.id,
						id_user: req.session.user_id,
						paid: 0,
						payment_type: item.payment_type
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

				reserved.push(item);
				removeFromCart(req, item.id_cart_item);
			}
		} catch (err) {
			errorHandler({ err, req });
			warnings.push(`${item.label} : la réservation a échoué`);
		}
	}

	req.session.item_to_pay = reserved.filter(item => item.payment_type === "direct");

	if (reserved.length && req.session.user_id) {
		try {
			const user = await backend.get({
				table: "user",
				id: req.session.user_id
			});

			const content = `<p>Bonjour ${user.result.firstname},</p>
			<p>Nous vous confirmons ${reserved.length > 1 ? "vos réservations" : "votre réservation"}, voici le détail:</p>
			<p>
				<ul>
					${reserved.map(item => `<li>${item.label} - Paiement: ${typeof item.payment_type === "number" ? "Formule" : item.payment_type === "direct" ? "En ligne" : "En personne"}</li>`).join("")}
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
		} catch (err) {
			errorHandler({ err, req });
		}
	}

	return { reserved, warnings };
};

const buildWarningHash = warnings => (warnings.length ? `#${encodeURIComponent(warnings.join(" — "))}` : "");

router.route("/checkout/:idTrainer").get(async (req, res) => {
	try {
		const allCartItems = await sortCartItemByTrainers(req);
		const trainerCart = allCartItems[req.params.idTrainer];

		if (!trainerCart) {
			// Panier déjà traité (double clic / retour arrière) : renvoyer vers la
			// session de paiement en cours s'il y en a une
			if (req.session.stripe_session_url) {
				return res.redirect(303, req.session.stripe_session_url);
			}

			return res.redirect(`${config.get("FRONT_URI")}/cart`);
		}

		const cartItems = (trainerCart.slot || []).concat(trainerCart.package || []);
		const { reserved, warnings } = await handleReservation(req, cartItems);
		const directItems = reserved.filter(item => item.payment_type === "direct");

		// Rien à payer en ligne : pas de passage par Stripe
		if (!directItems.length) {
			await saveSession(req);
			return res.redirect(config.get("FRONT_URI") + (req.session.cart.length ? `/cart${buildWarningHash(warnings)}` : `/account${buildWarningHash(warnings)}`));
		}

		const { stripe, vatApplicable } = await getTrainerStripe(req.params.idTrainer);
		const user = req.session.user_id ? await backend.get({ table: "user", id: req.session.user_id }) : null;

		const session = await stripe.checkout.sessions.create({
			success_url: `${config.get("BACK_URI")}/api/v1/cart/payment/success/${req.params.idTrainer}/{CHECKOUT_SESSION_ID}`,
			cancel_url: `${config.get("FRONT_URI")}/account/waiting_payments`,
			customer_email: user && user.result ? user.result.email : undefined,
			line_items: directItems.map(item => {
				return {
					price_data: {
						currency: "EUR",
						product_data: {
							name: item.label
						},
						// Math.round : un prix décimal (ex : 42.7) produit sinon un montant
						// non entier que Stripe rejette
						unit_amount: Math.round(item.price * 100)
					},
					quantity: 1
				};
			}),
			automatic_tax: {
				// Ne l'activer que pour les éducateurs assujettis : sur un compte Stripe
				// sans enregistrement fiscal, la création de session échoue
				enabled: vatApplicable
			},
			mode: "payment"
		});

		// Relier les réservations/formules à la session pour le webhook et le cron
		for (const item of directItems) {
			if (item.type === "slot" && item.reservation_id) {
				await backend.put({
					table: "reservation",
					where: { id: item.reservation_id },
					body: { payment_details: session.id }
				});
			}

			if (item.type === "package" && item.package_id) {
				await backend.put({
					table: "user_package",
					where: { id: item.package_id },
					body: { payment_details: session.id }
				});
			}
		}

		await backend.post({
			table: "payment_activity",
			body: {
				session_id: session.id,
				id_user: req.session.user_id,
				id_trainer: req.params.idTrainer,
				user_agent: req.headers["user-agent"],
				expire_at: new Date(session.expires_at * 1000).toISOString().slice(0, 19).replace("T", " "),
				details: JSON.stringify(directItems)
			}
		});

		req.session.stripe_session_id = session.id;
		req.session.stripe_session_url = session.url;
		req.session.item_to_pay = directItems;

		await saveSession(req);
		res.redirect(`${config.get("FRONT_URI")}/cart/success/${req.params.idTrainer}/${session.id}`);
	} catch (err) {
		errorHandler({ err, req, res });
	}
});

router.route("/stripe-redirect/:id_trainer/:session_id").get(async (req, res) => {
	try {
		const { stripe } = await getTrainerStripe(req.params.id_trainer);
		const session = await stripe.checkout.sessions.retrieve(req.params.session_id);

		if (session.status === "open" && session.url) {
			return res.redirect(303, session.url);
		}

		if (session.status === "complete") {
			// Déjà payée : confirmer et renvoyer vers le compte plutôt que de
			// tenter d'ouvrir une page Stripe qui n'existe plus
			return res.redirect(303, `${config.get("BACK_URI")}/api/v1/cart/payment/success/${req.params.id_trainer}/${session.id}`);
		}

		res.redirect(`${config.get("FRONT_URI")}/cart#session-expiree`);
	} catch (err) {
		errorHandler({ err, req });
		res.redirect(`${config.get("FRONT_URI")}/cart`);
	}
});

router.route("/stripe-redirect-no-trainer/:session_id").get(async (req, res) => {
	try {
		const payment_activity = await backend.get({
			table: "payment_activity",
			query: {
				session_id: req.params.session_id
			}
		});

		const id_trainer = payment_activity.result.length ? payment_activity.result[0].id_trainer : null;

		if (!id_trainer) {
			throw "Session introuvable";
		}

		const { stripe } = await getTrainerStripe(id_trainer);
		const session = await stripe.checkout.sessions.retrieve(req.params.session_id);

		if (session.status === "open" && session.url) {
			return res.redirect(303, session.url);
		}

		if (session.status === "complete") {
			return res.redirect(303, `${config.get("BACK_URI")}/api/v1/cart/payment/success/${id_trainer}/${session.id}`);
		}

		res.redirect(`${config.get("FRONT_URI")}/account#session-expiree`);
	} catch (err) {
		errorHandler({ err, req });
		res.redirect(`${config.get("FRONT_URI")}/account`);
	}
});

router.route("/get-session-status/:id_trainer/:session_id").get(async (req, res) => {
	try {
		const { stripe } = await getTrainerStripe(req.params.id_trainer);
		const session = await stripe.checkout.sessions.retrieve(req.params.session_id);

		res.send({
			status: session.status,
			payment_status: session.payment_status,
			redirect: !req.session || !req.session.cart || !req.session.cart.length ? "/account" : "/cart"
		});
	} catch (err) {
		errorHandler({ err, req, res });
	}
});

/*
 * URL de retour Stripe. Le webhook est la source de vérité ; cette route ne
 * fait que rejouer la même confirmation (idempotente) pour couvrir le cas où
 * le webhook n'est pas encore configuré ou pas encore arrivé.
 * L'ancien paramètre :id_user n'est plus utilisé : l'utilisateur est retrouvé
 * via payment_activity, jamais depuis l'URL.
 */
router.route("/payment/success/:id_trainer/:session_id/:id_user?").all(async (req, res) => {
	try {
		const { stripe } = await getTrainerStripe(req.params.id_trainer);
		const session = await stripe.checkout.sessions.retrieve(req.params.session_id);

		if (session.status !== "complete" || session.payment_status !== "paid") {
			return res.redirect(`${config.get("FRONT_URI")}/cart#payment-error`);
		}

		await confirmCheckoutSession({ id_trainer: req.params.id_trainer, session });

		const fromCart = !!req.session?.item_to_pay?.length;

		if (req.session) {
			req.session.item_to_pay = [];

			if (req.session.stripe_session_id === session.id) {
				delete req.session.stripe_session_id;
				delete req.session.stripe_session_url;
			}

			await saveSession(req);
		}

		res.redirect(config.get("FRONT_URI") + (fromCart ? "/close" : "/account/waiting_payments"));
	} catch (err) {
		errorHandler({ err, req, res });
	}
});

/*
 * Paiement d'un élément déjà réservé mais non réglé (bouton "Régler" du compte,
 * ou lien de paiement copié par l'éducateur).
 *
 * L'utilisateur garde sa place même si sa session Checkout d'origine a expiré ou
 * a échoué : on réutilise la session encore ouverte s'il y en a une, sinon on en
 * crée une nouvelle pour ce seul élément. Fonctionne aussi pour les éléments
 * marqués "à régler sur place" (later), et pour un créneau déjà passé (il arrive
 * qu'une séance soit réglée après coup).
 *
 * Autorisation : signature du lien (client non connecté), propriétaire connecté,
 * ou éducateur concerné.
 */
const isAuthorizedForPayment = (req, { type, id, id_owner, id_trainer }) => {
	if (verifyPaymentToken({ type, id, token: req.query.t })) {
		return true;
	}

	if (!req.session || !req.session.user_id) {
		return false;
	}

	return req.session.user_id === id_owner || (!!req.session.is_trainer && req.session.user_id === id_trainer);
};

/**
 * Crée (ou réutilise) une session Checkout pour un unique élément et l'enregistre
 * dans payment_activity pour que la confirmation (URL de retour, cron, webhook)
 * sache quoi marquer comme payé.
 */
const startSingleItemCheckout = async ({ req, id_trainer, id_user, email, label, price, existing_session_id, details, cancel_path }) => {
	const { stripe, vatApplicable } = await getTrainerStripe(id_trainer);

	// Session encore ouverte pour cet élément ? La réutiliser plutôt que d'en
	// empiler une nouvelle (double clic, onglet refermé, lien renvoyé...)
	if (String(existing_session_id || "").startsWith("cs_")) {
		try {
			const existing = await stripe.checkout.sessions.retrieve(existing_session_id);
			if (existing.status === "open" && existing.url) {
				return existing;
			}
		} catch (err) {
			// session inconnue/illisible : on en crée une nouvelle
		}
	}

	const session = await stripe.checkout.sessions.create({
		success_url: `${config.get("BACK_URI")}/api/v1/cart/payment/success/${id_trainer}/{CHECKOUT_SESSION_ID}`,
		cancel_url: `${config.get("FRONT_URI")}${cancel_path}`,
		customer_email: email || undefined,
		line_items: [
			{
				price_data: {
					currency: "EUR",
					product_data: {
						name: label
					},
					unit_amount: Math.round(price * 100)
				},
				quantity: 1
			}
		],
		automatic_tax: {
			enabled: vatApplicable
		},
		mode: "payment"
	});

	await backend.post({
		table: "payment_activity",
		body: {
			session_id: session.id,
			// Toujours le propriétaire de l'élément : avec un lien signé, celui qui
			// paie n'est pas forcément connecté
			id_user,
			id_trainer,
			user_agent: req.headers["user-agent"],
			expire_at: new Date(session.expires_at * 1000).toISOString().slice(0, 19).replace("T", " "),
			details: JSON.stringify(details)
		}
	});

	return session;
};

router.route("/pay-reservation/:id_reservation").get(async (req, res) => {
	const fallback = `${config.get("FRONT_URI")}/account/waiting_payments`;

	try {
		const rows = await query(
			`SELECT
				r.id,
				r.paid,
				r.enabled,
				r.payment_type,
				r.payment_details,
				s.date,
				s.id_trainer,
				a.label,
				a.price,
				d.id_user,
				u.email
			FROM reservation r
			JOIN slot s ON s.id = r.id_slot
			JOIN activity a ON a.id = s.id_activity
			JOIN dog d ON d.id = r.id_dog
			JOIN user u ON u.id = d.id_user
			WHERE r.id = ?`,
			[req.params.id_reservation]
		);

		const reservation = rows[0];

		if (!reservation) {
			return res.redirect(fallback);
		}

		if (!isAuthorizedForPayment(req, { type: "reservation", id: reservation.id, id_owner: reservation.id_user, id_trainer: reservation.id_trainer })) {
			return res.redirect(req.session && req.session.user_id ? fallback : `${config.get("FRONT_URI")}/login`);
		}

		if (!reservation.enabled || reservation.paid === 1) {
			return res.redirect(fallback);
		}

		const formattedDate = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" }).format(new Date(reservation.date));
		const label = `${reservation.label} - ${formattedDate}`;

		const session = await startSingleItemCheckout({
			req,
			id_trainer: reservation.id_trainer,
			id_user: reservation.id_user,
			email: reservation.email,
			label,
			price: parseFloat(reservation.price),
			existing_session_id: reservation.payment_details,
			details: [{ type: "slot", reservation_id: reservation.id, label, price: parseFloat(reservation.price) }],
			cancel_path: "/account/waiting_payments"
		});

		await query("UPDATE reservation SET payment_type = 'direct', payment_details = ? WHERE id = ?", [session.id, reservation.id]);

		res.redirect(303, session.url);
	} catch (err) {
		errorHandler({ err, req });
		res.redirect(fallback);
	}
});

router.route("/pay-package/:id_user_package").get(async (req, res) => {
	const fallback = `${config.get("FRONT_URI")}/account/waiting_payments`;

	try {
		const rows = await query(
			`SELECT
				up.id,
				up.paid,
				up.id_user,
				up.payment_details,
				p.label,
				p.price,
				p.id_trainer,
				u.email
			FROM user_package up
			JOIN package p ON p.id = up.id_package
			JOIN user u ON u.id = up.id_user
			WHERE up.id = ?`,
			[req.params.id_user_package]
		);

		const user_package = rows[0];

		if (!user_package) {
			return res.redirect(fallback);
		}

		if (!isAuthorizedForPayment(req, { type: "user_package", id: user_package.id, id_owner: user_package.id_user, id_trainer: user_package.id_trainer })) {
			return res.redirect(req.session && req.session.user_id ? fallback : `${config.get("FRONT_URI")}/login`);
		}

		if (user_package.paid === 1) {
			return res.redirect(fallback);
		}

		const session = await startSingleItemCheckout({
			req,
			id_trainer: user_package.id_trainer,
			id_user: user_package.id_user,
			email: user_package.email,
			label: user_package.label,
			price: parseFloat(user_package.price),
			existing_session_id: user_package.payment_details,
			details: [{ type: "package", package_id: user_package.id, label: user_package.label, price: parseFloat(user_package.price) }],
			cancel_path: "/account/waiting_payments"
		});

		await query("UPDATE user_package SET payment_type = 'direct', payment_details = ? WHERE id = ?", [session.id, user_package.id]);

		res.redirect(303, session.url);
	} catch (err) {
		errorHandler({ err, req });
		res.redirect(fallback);
	}
});

router.route("/make-reservation/:idTrainer").get(async (req, res) => {
	try {
		const allCartItems = await sortCartItemByTrainers(req);
		if (!allCartItems[req.params.idTrainer]) {
			return res.redirect(`${config.get("FRONT_URI")}/cart`);
		}

		const cartItems = (allCartItems[req.params.idTrainer].slot || []).concat(allCartItems[req.params.idTrainer].package || []);
		const { warnings } = await handleReservation(req, cartItems);

		await saveSession(req);
		res.redirect(config.get("FRONT_URI") + (req.session.cart.length ? "/cart" : "/account") + buildWarningHash(warnings));
	} catch (err) {
		errorHandler({ err, req, res });
	}
});

const Cart = _backend => {
	backend = _backend;
	return router;
};

export { Cart };
