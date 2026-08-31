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
import { errorHandler } from "./lib/utils.js";
import { buildPaymentUrl, resolveShortCode } from "./lib/payment-link.js";

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

			return user_package.result;
		} catch (err) {
			console.log(err);
			return [];
		}
	};

	backend.notify = async ({ who, action, what, how, id_what, detail_what, package_usage, dog }) => {
		const body = { id_user: who, action, what, how, id_what, detail_what, dog, package_usage };

		// Le CRUD générique sérialise en JSON toute valeur de type "object" : un null
		// devient la chaîne "null", que MySQL refuse sur une colonne entière
		// (package_usage, dog, id_what…). Seuls les champs renseignés sont transmis.
		Object.keys(body).forEach(key => {
			if (body[key] === null || typeof body[key] === "undefined") {
				delete body[key];
			}
		});

		// Une notification est accessoire : elle ne doit jamais faire échouer
		// l'action métier, ni provoquer un rejet non capturé (le processus tombe)
		try {
			await backend.post({ table: "notification", body });
		} catch (err) {
			console.log("Notification failed:", err?.error || err);
		}
	};
});
