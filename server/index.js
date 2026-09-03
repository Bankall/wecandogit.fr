import express from "express";
import cors from "cors";
import requestIp from "request-ip";
import path from "path";
import { fileURLToPath } from "url";

import session from "express-session";
import rawMySQLStore from "express-mysql-session";
import "dotenv/config";
import config from "config";

import MySQLBackend from "@bankall/mysql-backend";

import { Auth } from "./router/Auth/index.js";
import { Private } from "./router/Private/index.js";
import { Password } from "./router/Password/index.js";
import { Public } from "./router/Public/index.js";
import { Cart } from "./router/Cart/index.js";
import { Cron } from "./router/Cron/index.js";
import { WaitingList } from "./router/WaitingList/index.js";
import { StripeWebhook } from "./router/Stripe/index.js";
import { Push } from "./router/Push/index.js";
import { errorHandler } from "./lib/utils.js";
import { buildPaymentUrl, resolveShortCode } from "./lib/payment-link.js";
import { pushNotificationToTrainer } from "./lib/push.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3030;
const API_PATH = "/api/v1";

const app = express();
const backend = new MySQLBackend({
	app,
	path: API_PATH,
	config: {
		"mysql.host": config.get("mysql.host"),
		"mysql.user": config.get("mysql.user"),
		"mysql.password": config.get("mysql.password"),
		"mysql.database": config.get("mysql.database")
	}
});

/*
 * An empty listing must be an empty array, not an empty object.
 *
 * The query helper returns {} whenever a SELECT matches no row, whatever the
 * shape asked for. Every caller that treats a listing as a list then blew up on
 * the perfectly valid "nothing yet" case, because {} passes a `result || []`
 * guard and is neither iterable nor mappable, and that same {} was served as-is
 * to the frontend.
 *
 * A listing is exactly a query the helper is asked to return as an array, and
 * every read goes through handleQuery — including get() and the auto-generated
 * CRUD, which dispatch on `this` — so normalising here covers the whole
 * codebase. A get by id is not a listing and keeps returning an object, so
 * `if (!user.result.id)` checks are unaffected.
 */
const isEmptyObject = value => !!value && typeof value === "object" && !Array.isArray(value) && !Object.keys(value).length;
const queryWithoutNormalising = backend.handleQuery.bind(backend);

backend.handleQuery = async (query, args, eventKey, array, insertId) => {
	const response = await queryWithoutNormalising(query, args, eventKey, array, insertId);

	if (array && isEmptyObject(response.result)) {
		response.result = [];
	}

	return response;
};

app.set("trust proxy", 1);

app.use(
	cors({
		origin: config.get("ALLOWED_CORS_ORIGINS"),
		credentials: true,
		optionsSuccessStatus: 200
	})
);

// Le webhook Stripe vérifie la signature sur le corps brut : il doit être monté
// avant le parseur JSON global
app.use(`${API_PATH}/stripe`, StripeWebhook());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestIp.mw());

/*
 * Lien de paiement court, celui que les éducateurs copient et envoient à leurs
 * clients : <domaine>/p/<code> -> lien de paiement signé de l'élément concerné.
 * Le code fait office de secret, aucune session n'est nécessaire.
 */
app.get("/p/:code", async (req, res) => {
	try {
		const target = await resolveShortCode(req.params.code);

		if (!target) {
			return res.redirect(`${config.get("FRONT_URI")}/account/waiting_payments`);
		}

		res.redirect(302, buildPaymentUrl({ type: target.type, id: target.id, signed: true }));
	} catch (err) {
		errorHandler({ err, req });
		res.redirect(`${config.get("FRONT_URI")}/account/waiting_payments`);
	}
});

app.use(express.static(path.join(__dirname, "../dist")));

const MySQLStore = rawMySQLStore(session);
const sessionStore = new MySQLStore({
	host: config.get("mysql.host"),
	user: config.get("mysql.user"),
	port: 3306,
	password: config.get("mysql.password"),
	database: config.get("mysql.database")
});

const sess = {
	secret: process.env.SESSION_COOKIE_SECRET,
	resave: false,
	saveUninitialized: false,
	store: sessionStore,
	cookie: {
		httpOnly: true,
		sameSite: "lax",
		secure: "auto"
	}
};

app.use(session(sess));

app.use(`${API_PATH}/auth`, Auth(backend));
app.use(`${API_PATH}/password`, Password(backend));
app.use(`${API_PATH}/`, Private(backend));
app.use(`${API_PATH}/`, Public(backend));
app.use(`${API_PATH}/cart`, Cart(backend));
app.use(`${API_PATH}/cron`, Cron(backend));
app.use(`${API_PATH}/waiting-list`, WaitingList(backend));
app.use(`${API_PATH}/push`, Push());

/*
 * Contrôle d'accès des endpoints CRUD générés automatiquement par
 * @bankall/mysql-backend pour chaque table. Sans ce garde-fou, n'importe qui
 * pouvait lire/modifier les tables brutes (dont user: hash de mots de passe et
 * clés secrètes Stripe, et sessions: vol de session).
 *
 * Les routeurs ci-dessus répondent en priorité ; seules les requêtes qui
 * "retombent" sur le CRUD brut passent ici.
 */
const USER_WRITABLE_TABLES = new Set(["dog"]);
app.use(API_PATH, (req, res, next) => {
	const [segment] = req.path.replace(/^\/+/, "").split("/");

	if (!backend.cache.tableNames.includes(segment)) {
		return next();
	}

	if (segment === "sessions") {
		return res.status(404).send({ error: "Not found" });
	}

	if (req.session?.is_trainer) {
		return next();
	}

	if (req.session?.user_id && USER_WRITABLE_TABLES.has(segment)) {
		return next();
	}

	res.status(403).send({ error: "Vous n'avez pas accès à cette ressource" });
});

app.get(`${API_PATH}/fake-user/:id?`, async (req, res) => {
	if (!req.session.is_trainer) {
		return res.send({
			error: "Vous n'avez pas accès à cette page"
		});
	}

	const user = await backend.get({
		table: "user",
		id: req.params.id
	});

	req.session.email = user.result.email;
	req.session.user_id = user.result.id;
	req.session.is_trainer = user.result.is_trainer;

	res.send("Done");
});

app.get(`${API_PATH}/optout/:type/:email`, async (req, res) => {
	try {
		const body = {};
		if (req.params.type === "newsletter") {
			body.newsletter_optin = 0;
		} else if (req.params.type === "reminder") {
			body.reminder_optin = 0;
		}

		const response = await backend.put({
			table: "user",
			where: {
				email: req.params.email
			},
			body
		});

		if (response.result) {
			res.send("Enregistré");
		}
	} catch (err) {
		errorHandler({ err, req, res });
	}
});

// Un rejet non capturé (souvent une écriture accessoire non "awaited") tue le
// processus depuis Node 15 : on le journalise sans interrompre le service
process.on("unhandledRejection", reason => {
	console.log("Unhandled rejection:", reason);
});

backend.start(() => {
	app.listen(PORT, () => {
		console.log(`App listening on port ${PORT}!`);
	});

	backend.getUserPackageForID = async ({ id_reservation, id_slot, available, req }) => {
		try {
			const user_package = await backend.handleQuery(
				`
				SELECT
					up.id,
					up.usage,
					p.label,
					p.number_of_session

				FROM user_package up
				JOIN package p ON p.id = up.id_package
				LEFT JOIN package_activity pa ON pa.id_package = p.id
				JOIN slot s ON s.id_activity in (pa.id_activity) AND (s.id_trainer = p.id_trainer OR p.id_trainer = 36)

				${id_reservation ? "JOIN reservation r on r.id_slot = s.id and up.id_user = (select id_user from dog where id = r.id_dog)" : ""}

				WHERE 	1 = 1

				${id_slot ? "AND 	s.id = ?" : id_reservation ? "AND	r.id = ?" : ""}
				${available ? "AND up.usage < p.number_of_session" : ""}

				${!id_reservation ? "AND 	up.id_user = ?" : ""}

				GROUP BY up.id
				ORDER BY up.start ASC`,
				[id_reservation || id_slot, req.session.user_id],
				null,
				true
			);

			// The generic query helper returns an empty object, not an empty array,
			// when a SELECT matches no row. Callers expect a list, so normalise it:
			// having no package covering the slot is a perfectly valid case.
			return Array.isArray(user_package.result) ? user_package.result : [];
		} catch (err) {
			console.log(err);
			return [];
		}
	};

	backend.notify = async ({ who, action, what, how, id_what, detail_what, package_usage, dog }) => {
		const body = { id_user: who, action, what, how, id_what, detail_what, dog, package_usage };

		// The generic CRUD JSON-serialises any "object" value: a null becomes the
		// string "null", which MySQL rejects on an integer column (package_usage,
		// dog, id_what…). Only the fields that are set are sent.
		Object.keys(body).forEach(key => {
			if (body[key] === null || typeof body[key] === "undefined") {
				delete body[key];
			}
		});

		// A notification is incidental: it must never make the business action
		// fail, nor cause an unhandled rejection (which would kill the process)
		try {
			const notification = await backend.post({ table: "notification", body });

			// Device notification for the trainer owning the slot/package. Not
			// awaited: talking to the push services must not slow down a booking,
			// and their being unreachable is not the caller's problem.
			pushNotificationToTrainer(notification?.result?.id).catch(err => {
				console.log("Push notification failed:", err?.message || err);
			});
		} catch (err) {
			console.log("Notification failed:", err?.error || err);
		}
	};
});
