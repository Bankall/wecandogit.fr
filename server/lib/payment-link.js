import crypto from "crypto";
import config from "config";

import { query } from "./db.js";

/*
 * Liens de paiement signés.
 *
 * Un éducateur peut copier le lien de paiement d'une réservation ou d'une formule
 * et l'envoyer à son client (SMS, mail...). Le client n'est pas forcément connecté
 * quand il l'ouvre : le lien porte donc sa propre autorisation sous forme de
 * signature HMAC, plutôt que de dépendre d'une session.
 *
 * La signature ne couvre qu'un couple (type, id) précis : elle ne permet que de
 * PAYER cet élément, jamais de lire ou modifier quoi que ce soit d'autre. Le lien
 * reste valable jusqu'au règlement (la route de paiement refuse les éléments déjà
 * payés ou annulés), il n'y a donc pas d'expiration à gérer.
 */

const PAYABLE_TYPES = new Set(["reservation", "user_package"]);

const getSecret = () => {
	const secret = process.env.PAYMENT_LINK_SECRET || process.env.SESSION_COOKIE_SECRET;

	if (!secret) {
		throw new Error("PAYMENT_LINK_SECRET (ou SESSION_COOKIE_SECRET) est requis pour signer les liens de paiement");
	}

	return secret;
};

const signPaymentTarget = ({ type, id }) => {
	if (!PAYABLE_TYPES.has(type)) {
		throw new Error(`Type de paiement inconnu: ${type}`);
	}

	return crypto.createHmac("sha256", getSecret()).update(`${type}:${id}`).digest("base64url").slice(0, 24);
};

const verifyPaymentToken = ({ type, id, token }) => {
	try {
		if (!token || !PAYABLE_TYPES.has(type)) {
			return false;
		}

		const expected = Buffer.from(signPaymentTarget({ type, id }));
		const provided = Buffer.from(String(token));

		return expected.length === provided.length && crypto.timingSafeEqual(expected, provided);
	} catch (err) {
		return false;
	}
};

const PAYMENT_PATHS = {
	reservation: "pay-reservation",
	user_package: "pay-package"
};

/**
 * URL de paiement absolue. Avec `signed: true` (liens copiés par l'éducateur) le
 * lien fonctionne sans session ; sans signature il n'est utilisable que par le
 * propriétaire connecté (liens affichés dans son propre compte).
 */
const buildPaymentUrl = ({ type, id, signed = false }) => {
	const url = `${config.get("BACK_URI")}/api/v1/cart/${PAYMENT_PATHS[type]}/${id}`;
	return signed ? `${url}?t=${signPaymentTarget({ type, id })}` : url;
};

/*
 * Liens courts (table payment_link) : un lien signé n'est pas présentable dans un
 * SMS, on l'expose donc sous la forme <domaine>/p/<code>. Le code est aléatoire et
 * fait office de secret ; il redirige vers le lien signé correspondant.
 *
 * Un code est créé une fois par élément puis réutilisé : le même lien reste donc
 * valable si l'éducateur le renvoie plus tard.
 */
const SHORT_CODE_LENGTH = 10;

const createShortCode = () => crypto.randomBytes(12).toString("base64url").slice(0, SHORT_CODE_LENGTH);

const ensureShortCodes = async targets => {
	const unique = [...new Map(targets.map(target => [`${target.type}:${target.id}`, target])).values()].filter(target => PAYABLE_TYPES.has(target.type) && target.id);

	if (!unique.length) {
		return new Map();
	}

	// INSERT IGNORE : ne recrée pas un code existant (clé unique sur type+target_id)
	// et supporte deux requêtes concurrentes sur le même élément
	await query(
		`INSERT IGNORE INTO payment_link (code, type, target_id) VALUES ${unique.map(() => "(?, ?, ?)").join(", ")}`,
		unique.flatMap(target => [createShortCode(), target.type, target.id])
	);

	const rows = await query(
		`SELECT code, type, target_id FROM payment_link WHERE (type, target_id) IN (${unique.map(() => "(?, ?)").join(", ")})`,
		unique.flatMap(target => [target.type, target.id])
	);

	return new Map(rows.map(row => [`${row.type}:${row.target_id}`, row.code]));
};

/**
 * URLs de paiement courtes, indexées par `type:id`. En cas de souci sur la table
 * des liens courts, on retombe sur l'URL signée longue : le lien reste utilisable.
 */
const buildShortPaymentUrls = async targets => {
	let codes = new Map();

	try {
		codes = await ensureShortCodes(targets);
	} catch (err) {
		console.log("Short payment links unavailable:", err.message || err);
	}

	const urls = new Map();
	targets.forEach(({ type, id }) => {
		const key = `${type}:${id}`;
		const code = codes.get(key);

		urls.set(key, code ? `${config.get("BACK_URI")}/p/${code}` : buildPaymentUrl({ type, id, signed: true }));
	});

	return urls;
};

const resolveShortCode = async code => {
	const rows = await query("SELECT type, target_id FROM payment_link WHERE code = ?", [String(code || "")]);
	return rows.length ? { type: rows[0].type, id: rows[0].target_id } : null;
};

export { signPaymentTarget, verifyPaymentToken, buildPaymentUrl, buildShortPaymentUrls, resolveShortCode };
