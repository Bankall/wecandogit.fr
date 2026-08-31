import { Router } from "express";
import { errorHandler } from "../../lib/utils.js";
import { getTrainerStripe } from "../../lib/stripe.js";
import { confirmCheckoutSession, markCheckoutExpired } from "../../lib/booking.js";

import MailSender from "../../lib/mail-sender/index.cjs";
let backend;

const router = Router();

// Les routes cron déclenchent des emails et des écritures : elles ne doivent pas
// être appelables par n'importe qui. Définir CRON_SECRET dans .env et ajouter
// ?token=<CRON_SECRET> à l'appel du cron.
router.use((req, res, next) => {
	if (process.env.CRON_SECRET && req.query.token !== process.env.CRON_SECRET) {
		return res.status(403).send("Forbidden");
	}

	next();
});

router.route("/ping").get((req, res) => {
	res.send("pong");
});

const Cron = _backend => {
	backend = _backend;
	return router;
};

router.route("/send-reminder-mail").get(async (req, res) => {
	try {
		const Reminders = await backend.handleQuery(
			`select
				r.id id_reservation,
				a.label activity,
				date_format(s.date, '%d/%m à %H:%i') date,
				u.email,
				d.label dog,
				u.firstname user
				
			from 		reservation r
			join 		slot s on s.id = r.id_slot
			join		activity a on a.id = s.id_activity
			join 		dog d on d.id = r.id_dog
			join 		user u on u.id = d.id_user
			left join 	reminder_mail rm on rm.id_reservation = r.id

			where 	rm.sent is null
			
			and 	u.id != 2
			and 	s.date > current_timestamp
			and 	s.date < date_add(current_timestamp, interval 1 day)
			and 	r.enabled = 1
			and 	s.enabled = 1

			order by s.date asc`,
			null,
			null,
			true
		);

		if (!Reminders.result || !Reminders.result.length) {
			return res.send("No reminders to send");
		}

		const promises = Reminders.result.map(async reminder => {
			const content = `<p>Bonjour ${reminder.user},</p><p>Ceci est un rappel pour votre réservation de ${reminder.activity} le ${reminder.date} avec ${reminder.dog}.</p><p>A bientôt !</p><br/><br/><p style='color: #ED4337;'>Attention, pour tout créneau au parc de loisirs, merci de laisser vos chiens patienter dans votre voiture jusqu'à ce que l'on vienne vous chercher pour votre activité, et de ne pas les promener sur le parking ni à proximité du jardin de nos voisins.</p>`;

			await MailSender.send({
				subject: "Votre séance approche",
				email: reminder.email,
				macros: {
					PRE_HEADER: "Un petit rappel concernant votre prochaine séance",
					CONTENT_HTML: content,
					EMAIL_TYPE: "reminder",
					EMAIL: reminder.email
				}
			});

			await backend.post({
				table: "reminder_mail",
				body: {
					id_reservation: reminder.id_reservation,
					sent: 1
				}
			});
		});

		await Promise.all(promises);
		res.send("Reminders sent");
	} catch (err) {
		errorHandler({ err, res, req });
	}
});

/*
 * Filet de sécurité du webhook : rattrape les sessions payées dont la
 * confirmation n'a pas été reçue, et solde les sessions expirées pour sortir
 * ces lignes de la file (sinon elles sont re-vérifiées auprès de Stripe à
 * chaque exécution, indéfiniment). Les réservations non payées, elles,
 * restent actives : l'utilisateur garde sa place et règle plus tard.
 */
router.route("/check-missing-payments").get(async (req, res) => {
	try {
		const response = [];
		const missingPayments = await backend.handleQuery(
			`select
				pa.id_trainer,
				pa.session_id,
				pa.id_user
			from
				payment_activity pa
			left outer join payment_history ph on pa.session_id = ph.session_id
			where ph.session_id is null
			order by pa.id desc`,
			null,
			null,
			true
		);

		if (!missingPayments.result || !missingPayments.result.length) {
			return res.send("No missing payments");
		}

		for (const payment of missingPayments.result) {
			const { id_trainer, session_id, id_user } = payment;

			try {
				const { stripe } = await getTrainerStripe(id_trainer);
				const session = await stripe.checkout.sessions.retrieve(session_id);

				if (session.payment_status === "paid") {
					await confirmCheckoutSession({ id_trainer, session });
				} else if (session.status === "expired") {
					await markCheckoutExpired({ session_id });
				}

				const user = await backend.get({
					table: "user",
					id: id_user
				});

				response.push([`${user.result.firstname} ${user.result.lastname}`, session.amount_total / 100, session.payment_status, session.status, session_id].join(" - "));
			} catch (err) {
				errorHandler({ err, req });
				response.push([session_id, "erreur", err.message].join(" - "));
			}
		}

		res.send(response.join("<br/>"));
	} catch (err) {
		errorHandler({ err, res, req });
	}
});

export { Cron };
