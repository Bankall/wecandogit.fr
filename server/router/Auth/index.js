import { Router } from "express";
import { validateEmail, assert, errorHandler } from "../../lib/utils.js";

import config from "config";
import axios from "axios";
import bcrypt from "bcrypt";

let backend;

const router = Router();
router.route("/ping").get((req, res) => {
	res.send("pong");
});

router.route("/oauth/get-google-redirect-url").all(async (req, res) => {
	try {
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

		req.session.redirect = req.body.redirect;
		res.send(url);
	} catch (err) {
		errorHandler({ err, req, res });
	}
});

router.route("/oauth/callback/").get(async (req, res) => {
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
		const tokenRequest = await axios.post(url, queryString, {
			headers: {
				"Content-Type": "application/x-www-form-urlencoded"
			}
		});

		const { id_token, access_token } = tokenRequest.data;

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

		const cart = req.session.cart;
		const redirect = req.session.redirect;
		req.session.regenerate(async err => {
			if (err) next(err);

			req.session.email = googleUser.email;
			req.session.cart = cart;

			let user = await backend.get({ table: "user", query: { email: googleUser.email } });

			if (!user.result.length) {
				user = await backend.post({
					table: "user",
					body: {
						email: googleUser.email,
						firstname: googleUser.given_name,
						lastname: googleUser.family_name
					}
				});

				req.session.user_id = user.result.id;
			} else {
				req.session.user_id = user.result[0].id;
				req.session.is_trainer = user.result[0].is_trainer;

				res.cookie("is_trainer", req.session.is_trainer);
			}

			res.cookie("username", googleUser.given_name);
			res.cookie("email", googleUser.email);

			res.redirect(config.get("FRONT_URI") + (redirect || "/account"));
		});
	} catch (err) {
		errorHandler({ err, req });
		res.redirect(config.get("FRONT_URI") + "/account");
	}
});

router.route("/create-user").post(async (req, res, next) => {
	try {
		await assert(req.body.email, req.body.password, req.body.firstname, req.body.lastname, req.body.phone);

		req.body.password = await bcrypt.hash(req.body.password, 10);
		const existingUser = await backend.get({
			table: "user",
			query: {
				email: req.body.email
			}
		});

		let newUser;
		if (existingUser.result.length && !existingUser.result[0].password) {
			newUser = await backend.put({
				table: "user",
				body: req.body,
				where: {
					id: existingUser.result[0].id
				}
			});
		} else {
			newUser = await backend.post({
				table: "user",
				body: req.body
			});
		}

		const cart = req.session.cart;
		req.session.regenerate(async err => {
			if (err) next(err);

			req.session.loggedIn = true;
			req.session.email = req.body.email;
			req.session.user_id = newUser.result.id;

			req.session.cart = cart;

			res.cookie("username", req.body.firstname);
			res.cookie("email", req.body.email);

			res.send({
				ok: true,
				location: req.body.redirect || "/account"
			});
		});
	} catch (err) {
		errorHandler({ err, req });
		res.send({
			error: (err.error || "").match("Duplicate entry") ? "Un compte existe déjà avec cette adresse email" : "Une erreur s'est produite"
		});
	}
});

router.route("/login").post(async (req, res) => {
	try {
		const email = req.body.email;
		if (!email) {
			throw { error: "Adresse email manquante" };
		}

		const isValidEmail = validateEmail(email);
		if (!isValidEmail) {
			throw { error: "Adresse email invalide" };
		}

		if (!req.body.password) {
			throw { error: "Mot de pass manquant" };
		}

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

		const cart = req.session.cart;

		req.session.regenerate(async err => {
			if (err) next(err);

			req.session.email = user.result[0].email;
			req.session.user_id = user.result[0].id;
			req.session.is_trainer = user.result[0].is_trainer;

			req.session.cart = cart;

			res.cookie("username", user.result[0].firstname);
			res.cookie("email", req.body.email);
			res.cookie("is_trainer", req.session.is_trainer);

			res.send({
				ok: true,
				location: req.body.redirect || "/account"
			});
		});
	} catch (err) {
		errorHandler({ err, req, res });
	}
});

router.route("/logout").all((req, res) => {
	try {
		req.session.destroy();

		res.cookie("username", "");
		res.cookie("email", "");
		res.cookie("is_trainer", "");
	} catch (err) {
		console.log(err);
	} finally {
		res.redirect(config.get("FRONT_URI") + "/");
	}
});

const Auth = _backend => {
	backend = _backend;
	return router;
};

export { Auth };
