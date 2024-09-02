import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
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

import { errorHandler } from "./lib/utils.js";

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

app.use(
	cors({
		origin: config.get("ALLOWED_CORS_ORIGINS"),
		credentials: true,
		optionsSuccessStatus: 200
	})
);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(requestIp.mw());
app.use(express.static(path.join(__dirname, "../dist")));

const MySQLStore = rawMySQLStore(session);
const sessionStore = new MySQLStore({
	host: config.get("mysql.host"),
	user: config.get("mysql.user"),
	port: 3306,
	password: config.get("mysql.password"),
	database: "wecandogit"
});

const sess = {
	secret: process.env.SESSION_COOKIE_SECRET,
	resave: false,
	saveUninitialized: true,
	store: sessionStore,
	cookie: {}
};

app.use(session(sess));

app.use(`${API_PATH}/auth`, Auth(backend));
app.use(`${API_PATH}/password`, Password(backend));
app.use(`${API_PATH}/`, Private(backend));
app.use(`${API_PATH}/`, Public(backend));
app.use(`${API_PATH}/cart`, Cart(backend));

app.get(`${API_PATH}/fake-user/:id?`, async (req, res) => {
	if (![1, 36].includes(req.session.user_id)) {
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

backend.start(() => {
	app.listen(PORT, () => {
		console.log(`App listening on port ${PORT}!`);
	});

	// app.get("*", (req, res) => {
	// 	res.sendFile(path.join(__dirname, "../dist", "index.html"));
	// });

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
			return {};
		}
	};

	backend.notify = async ({ who, action, what, how, id_what }) => {
		// try {
		// 	const user = await backend.get({
		// 		table: "user",
		// 		id: who
		// 	});

		// 	const email = user.result[0].email;

		// 	await MailSender.send({
		// 		subject: `Notification de votre ${action}`,
		// 		email,
		// 		macros: {
		// 			CONTENT_HTML: `Vous avez ${action} ${what} ${how}`,
		// 			CONTENT_TXT: `Vous avez ${action} ${what} ${how}`
		// 		}
		// 	});

		// 	return { ok: true };
		// } catch (err) {
		// 	return err;
		// }

		backend.post({
			table: "notification",
			body: {
				id_user: who,
				action,
				what,
				how,
				id_what
			}
		});
	};
});
