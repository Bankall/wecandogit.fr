import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import requestIp from "request-ip";
import path from "path";
import axios from "axios";
import { fileURLToPath } from "url";

import session from "express-session";
import rawMySQLStore from "express-mysql-session";
import "dotenv/config";
import config from "config";
import bcrypt from "bcrypt";
import md5 from "md5";

import MySQLBackend from "@bankall/mysql-backend";
import MailSender from "./lib/mail-sender/index.cjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3030;
const API_PATH = "/api/v1";

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

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
		origin: config.get("FRONT_URI"),
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

const shuffle = array => {
	const shuffled = [...array];
	let currentIndex = shuffled.length;

	// While there remain elements to shuffle...
	while (currentIndex != 0) {
		// Pick a remaining element...
		let randomIndex = Math.floor(Math.random() * currentIndex);
		currentIndex--;

		// And swap it with the current element.
		[shuffled[currentIndex], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[currentIndex]];
	}

	return shuffled;
};

const isLoggedIn = req => {
	return !!req.session.loggedIn;
};

const isLoggedInMw = (req, res, next) => {
	if (isLoggedIn(req)) {
		return next();
	}

	return next("route");
};

const isTrainer = async (req, res, next) => {
	if (req.session && req.session.is_trainer) {
		return req.session.is_trainer;
	}

	const user = backend.get({
		table: "user",
		query: {
			id: req.session.id
		}
	});
	console.log(user.result);
	if (user.result) {
		req.session.is_trainer = user.result[0].is_trainer;
		return req.session.is_trainer;
	}
};

const validateEmail = email => {
	const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

	if (!email || email.length > 254) return false;
	if (!emailRegex.test(email)) return false;

	const parts = email.split("@");
	if (parts[0].length > 64) return false;

	const domainParts = parts[1].split(".");
	if (domainParts.some(part => part.length > 63)) return false;

	return true;
};

const getResetPasswordToken = email => {
	const token = md5(`${process.env.PASSWORD_RECOVERY_SALT}/${email}`);
	return token;
};

const assert = async (...args) => {
	try {
		const ok = args.every(item => typeof item !== "undefined");
		if (!ok) throw { error: "Some key are missing" };

		return true;
	} catch (err) {
		throw err;
	}
};

app.get(`${API_PATH}/auth/oauth/get-google-redirect-url`, async (req, res) => {
	const rootUrl = "https://accounts.google.com/o/oauth2/v2/auth";
	const options = {
		redirect_uri: config.get("GOOGLE_OAUTH_REDIRECT_URI"),
		client_id: process.env.AUTH_GOOGLE_ID,
		access_type: "online",
		response_type: "code",
		prompt: "consent",
		scope: ["https://www.googleapis.com/auth/userinfo.profile", "https://www.googleapis.com/auth/userinfo.email"].join(" ")
	};

	const queryString = new URLSearchParams(options).toString();
	const url = `${rootUrl}?${queryString.toString()}`;

	res.send(url);
});

app.get(`${API_PATH}/auth/oauth/callback`, async (req, res) => {
	try {
		const code = req.query.code;
		const url = "https://oauth2.googleapis.com/token";

		const options = {
			code,
			client_id: process.env.AUTH_GOOGLE_ID,
			client_secret: process.env.AUTH_GOOGLE_SECRET,
			redirect_uri: config.get("GOOGLE_OAUTH_REDIRECT_URI"),
			grant_type: "authorization_code"
		};

		const queryString = new URLSearchParams(options);

		const { id_token, access_token } = (
			await axios.post(url, queryString.toString(), {
				headers: {
					"Content-Type": "application/x-www-form-urlencoded"
				}
			})
		).data;

		const googleUser = (
			await axios.get(`https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${access_token}`, {
				headers: {
					Authorization: `Bearer ${id_token}`
				}
			})
		).data;

		if (!googleUser) {
			return res.redirect(`${config.get("FRONT_URI")}/login#google-error`);
		}

		req.session.regenerate(async err => {
			if (err) next(err);

			req.session.loggedIn = true;
			req.session.email = googleUser.email;

			let user = await backend.get({ table: "user", query: { email: googleUser.email } });
			if (!Object.keys(user.result).length) {
				// Insert user here
				user = await backend.post({
					table: "user",
					body: {
						email: googleUser.email,
						firstname: googleUser.given_name,
						lastname: googleUser.family_name
					}
				});

				req.session.userId = user.result.id;
			} else {
				req.session.userId = user.result[0].id;
			}

			res.cookie("username", googleUser.given_name);
			res.cookie("email", googleUser.email);

			res.redirect(config.get("FRONT_URI") + (req.body.redirect || "/account"));
		});
	} catch (err) {
		console.log(err);
	}
});

app.post(`${API_PATH}/create-user`, async (req, res, next) => {
	try {
		await assert(req.body.email, req.body.password, req.body.firstname, req.body.lastname, req.body.phone);

		req.body.password = await bcrypt.hash(req.body.password, 10);

		const newUser = await backend.post({
			table: "user",
			body: req.body
		});

		req.session.regenerate(async err => {
			if (err) next(err);

			req.session.loggedIn = true;
			req.session.email = req.body.email;
			req.session.userId = newUser.result.id;

			res.cookie("username", req.body.firstname);
			res.cookie("email", req.body.email);

			res.send({
				ok: true,
				location: req.body.redirect || "/account"
			});
		});
	} catch (err) {
		res.send({
			error: err.error.match("Duplicate entry") ? "Un compte existe déjà avec cette adresse email" : "Une erreur s'est produite"
		});
	}
});

app.put(`${API_PATH}/update-user`, async (req, res, next) => {
	try {
		const update = await backend.put({
			table: "user",
			id: req.session.userId,
			body: req.body
		});

		console.log(req.session.userId);
		console.log(req.body);

		res.send({
			ok: true
		});
	} catch (err) {
		res.send({
			error: err.error
		});
	}
});

app.post(`${API_PATH}/auth/login`, async (req, res) => {
	try {
		await assert(req.body.email, req.body.password);

		const user = await backend.get({
			table: "user",
			query: {
				email: req.body.email
			}
		});

		if (!user.result.length) {
			throw { error: "Aucun compte n'existe avec cette adresse" };
		}

		const passwordMatch = await bcrypt.compare(req.body.password, user.result[0].password);
		if (!passwordMatch) {
			throw { error: "Mot de passe incorrect" };
		}

		req.session.regenerate(async err => {
			if (err) next(err);

			req.session.loggedIn = true;
			req.session.email = req.body.email;
			req.session.userId = user.result[0].id;

			res.cookie("username", user.result[0].firstname);
			res.cookie("email", req.body.email);

			res.send({
				ok: true,
				location: req.body.redirect || "/account"
			});
		});
	} catch (err) {
		res.send({
			error: err.error
		});
	}
});

app.get(`${API_PATH}/auth/logout`, async (req, res) => {
	req.session.destroy();

	res.cookie("username", "");
	res.cookie("email", "");
	res.redirect(config.get("FRONT_URI") + "/");
});

app.get(`${API_PATH}/is-logged-in`, async (req, res) => {
	res.send({
		ok: isLoggedIn(req)
	});
});

app.get(`${API_PATH}/send-reset-password-link/:email`, async (req, res) => {
	try {
		const email = req.params.email;
		if (!email) {
			throw { error: "Missing email" };
		}

		const isValidEmail = validateEmail(email);
		if (!isValidEmail) {
			throw { error: "Invalid email" };
		}

		const emailVerificationLink = config.get("FRONT_URI") + `/reset-password/new-password/?email=${encodeURIComponent(email)}&token=${getResetPasswordToken(email)}`;

		await MailSender.send({
			subject: "Réinitialisation de votre mot de passe",
			email: req.params.email,
			macros: {
				CONTENT_HTML: `Veuillez cliquer sur le lien suivant <br/><a href="${emailVerificationLink}" target="_blank">${emailVerificationLink}</a>`,
				CONTENT_TXT: `Veuillez copier le lien suivant dans votre navigateur ${emailVerificationLink}`
			}
		});

		res.send({
			ok: true
		});
	} catch (err) {
		res.send({
			error: err.error
		});
	}
});

app.post(`${API_PATH}/reset-password`, async (req, res) => {
	try {
		await assert(req.body.email, req.body.token, req.body.password);

		const tokenIsValid = getResetPasswordToken(req.body.email) === req.body.token;
		if (!tokenIsValid) {
			throw { error: "Invalid Token" };
		}

		await backend.put({
			table: "user",
			where: {
				email: req.body.email
			},
			body: {
				password: await bcrypt.hash(req.body.password, 10)
			}
		});

		res.send({
			ok: true
		});
	} catch (err) {
		res.send({
			error: err.error
		});
	}
});

app.get(`${API_PATH}/me`, async (req, res) => {
	try {
		await assert(req.session.email);

		const data = await backend.get({
			table: "user",
			query: {
				email: req.session.email
			}
		});

		if (!data.result.length) {
			throw { error: "Could not find user data" };
		}

		delete data.result[0].password;

		res.send({
			ok: true,
			result: data.result[0]
		});
	} catch (err) {
		res.send({
			error: err.error
		});
	}
});

app.post(`${API_PATH}/activity`, (req, res, next) => {
	req.body.id_trainer = req.session.userId;
	next();
});

app.put(`${API_PATH}/activity/:id`, (req, res, next) => {
	req.where = Object.assign({ id_trainer: req.session.userId }, req.where);
	next();
});

app.get(`${API_PATH}/activity`, (req, res, next) => {
	req.query = Object.assign({ id_trainer: req.session.userId }, req.query);
	next();
});

app.get(`${API_PATH}/activity/:id`, (req, res, next) => {
	req.query = Object.assign({ id_trainer: req.session.userId }, req.query);
	next();
});

app.get(`${API_PATH}/get-cart-item`, async (req, res) => {
	const count = parseInt(Math.random() * 3);
	res.send({ count });
});

app.get(`${API_PATH}/get-next-collective-activities`, async (req, res) => {
	res.send([
		{
			date: "27/06",
			time: "10h",
			name: "Agility en Collectif",
			trainer: "Chloe",
			id: 123
		},
		{
			date: "27/06",
			time: "11h",
			name: "Classe Ado Adulte",
			trainer: "Chloe",
			id: 456
		},
		{
			date: "27/06",
			time: "11h",
			name: "Balade a theme (Reims)",
			trainer: "Elodie",
			id: 789
		},
		{
			date: "27/06",
			time: "12h",
			name: "Balade collective (Sermiers)",
			trainer: "Elodie",
			id: 1011
		},
		{
			date: "27/06",
			time: "15h",
			name: "Parc en collectif",
			trainer: "Elodie",
			id: 1213
		}
	]);
});

app.get(`${API_PATH}/get-next-individual-slots`, async (req, res) => {
	res.send([
		{
			date: "27/06",
			time: "15h",
			name: "Atelier Educatif",
			trainer: "Chloe",
			id: 1234
		},
		{
			date: "27/06",
			time: "15h30",
			name: "Atelier Educatif",
			trainer: "Chloe",
			id: 4567
		},
		{
			date: "27/06",
			time: "16h",
			name: "Bilan a domicile",
			trainer: "Elodie",
			id: 7891
		},
		{
			date: "27/06",
			time: "17h",
			name: "Bilan à domicile",
			trainer: "Elodie",
			id: 10112
		}
	]);
});

app.get(`${API_PATH}/get-trainers-description`, async (req, res) => {
	const trainers = [
		{
			id: 123,
			name: "Chloe Ternier",
			description: `Après avoir été infirmière pendant près de 10 ans, j'ai choisi de changer de voie pour m'investir dans le bien-être canin. Passionnée de sport (course à pied et triathlon), je suis persuadée que la pratique des sports canins peut permettre d'améliorer grandement non seulement la relation humain/chien, mais également aider à résoudre de nombreux troubles du comportement chez le chien. 

J'ai également conscience que de nombreux propriétaires ont besoin d'être guidés dans l'éducation de leur chien, d'apprendre à communiquer avec lui, à répondre à ses besoins. Mais aussi du fait que ces propriétaires sont de plus en plus soucieux du bien-être de leur animal.  J'ai donc débuté ma formation de cynologiste en septembre 2020, avant de quitter mon poste à l'hôpital au mois de juillet suivant afin de me consacrer entièrement à cette reconversion et à ce projet. 

J'ai obtenu mon diplôme de Cynologiste en juillet 2022.`,
			photo: "/assets/medias/chloe.jpg"
		},
		{
			id: 345,
			name: "Elodie Decouleur",
			description: `J'ai été commerciale durant 8 ans, avant d'être pendant 2 ans chef de publicité. En septembre 2020, j'ai décidé d'arrêter mon activité salariée, afin de me consacrer pleinement à mon activité secondaire, l'éducation et la rééducation des chiens de compagnie. 

Je suis passionnée de chiens depuis toujours, mais c'est en 2016 que j'ai validé le diplôme d'éducatrice comportementaliste, Cynologiste et que j'ai ouvert Amity Dog. 

J'accompagne depuis les familles et les associations de protection animale, en les aidant à mieux comprendre les chiens.`,
			photo: "/assets/medias/FB_IMG_1599744511817.jpg"
		}
	];

	res.send({
		trainers: shuffle(trainers)
	});
});

app.get(`${API_PATH}/get-activities-by-trainer`, async (req, res) => {
	const trainers = [
		{
			id: 123,
			name: "Chloe Ternier",
			activities: [
				{
					id: 123,
					label: "Agility"
				},
				{
					id: 456,
					label: "Dog Dancing"
				}
			]
		},
		{
			id: 345,
			name: "Elodie Decouleur",
			activities: [
				{
					id: 123,
					label: "Man-trailing"
				},
				{
					id: 456,
					label: "Nose work"
				}
			]
		}
	];

	res.send({
		trainers: shuffle(trainers)
	});
});

app.listen(PORT, () => {
	console.log(`App listening on port ${PORT}!`);
});

backend.start(() => {
	app.get("*", (req, res) => {
		res.sendFile(path.join(__dirname, "../dist", "index.html"));
	});
});
