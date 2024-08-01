import { Router } from "express";
import { validateEmail, errorHandler } from "../../lib/utils.js";
import bcrypt from "bcrypt";
import md5 from "md5";
import config from "config";
import MailSender from "../../lib/mail-sender/index.cjs";

let backend;

const getResetPasswordToken = email => {
	const token = md5(`${process.env.PASSWORD_RECOVERY_SALT}/${email}`);
	return token;
};

const router = Router();
router.route("/ping").get((req, res) => {
	res.send("pong");
});

router.route("/send-reset-mail/:email").get(async (req, res) => {
	try {
		const email = req.params.email;
		if (!email) {
			throw { error: "Adresse email manquante" };
		}

		const isValidEmail = validateEmail(email);
		if (!isValidEmail) {
			throw { error: "Adresse email invalide" };
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
		errorHandler({ err, req, res });
	}
});

router.route("/reset").post(async (req, res) => {
	try {
		const email = req.body.email;
		if (!email) {
			throw { error: "Adresse email manquante" };
		}

		const isValidEmail = validateEmail(email);
		if (!isValidEmail) {
			throw { error: "Adresse email invalide" };
		}

		const tokenIsValid = getResetPasswordToken(req.body.email) === req.body.token;
		if (!tokenIsValid) {
			throw { error: "Invalid Token" };
		}

		await backend.put({
			table: "user",
			where: {
				email: email
			},
			body: {
				password: await bcrypt.hash(req.body.password, 10)
			}
		});

		res.send({
			ok: true
		});
	} catch (err) {
		errorHandler({ err, req, res });
	}
});

const Password = _backend => {
	backend = _backend;
	return router;
};

export { Password };
