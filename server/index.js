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

backend.start(() => {
	app.listen(PORT, () => {
		console.log(`App listening on port ${PORT}!`);
	});

	app.get("*", (req, res) => {
		res.sendFile(path.join(__dirname, "../dist", "index.html"));
	});
});
