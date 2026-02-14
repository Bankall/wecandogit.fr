import { Router } from "express";
import { Stripe } from "stripe";
import { errorHandler } from "../../lib/utils.js";

import MailSender from "../../lib/mail-sender/index.cjs";
let backend;

const router = Router();
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

router.route("/check-missing-payments").get(async (req, res) => {
	try {
		const stripeSkByTrainer = {};
		const missingPayments = await backend.handleQuery(
			`select 
				pa.id_trainer,
				pa.session_id,
				pa.id_user,
				pa.details
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

		for await (const payment of missingPayments.result) {
			const { id_trainer, session_id, details, id_user } = payment;

			if (!stripeSkByTrainer[id_trainer]) {
				const trainer = await backend.get({
					table: "user",
					query: {
						id: id_trainer
					}
				});

				const stripe_sk = trainer.result.length ? trainer.result[0].stripe_sk : null;
				stripeSkByTrainer[id_trainer] = stripe_sk;
			}

			const stripe_sk = stripeSkByTrainer[id_trainer];
			const stripe = Stripe(stripe_sk);
			const session = await stripe.checkout.sessions.retrieve(session_id);

			const { amount_total, payment_status, status } = session;

			if (payment_status === "paid") {
				await backend.post({
					table: "payment_history",
					body: {
						session_id,
						details,
						id_trainer,
						id_user,
						status,
						amount: amount_total
					}
				});

				const detailsParsed = JSON.parse(details);
				for await (const item of detailsParsed) {
					const { type, reservation_id, package_id } = item;

					if (type === "slot" && reservation_id) {
						await backend.put({
							table: "reservation",
							id: reservation_id,
							body: {
								paid: 1
							}
						});
					}

					if (type === "package" && package_id) {
						await backend.put({
							table: "user_package",
							id: package_id,
							body: {
								paid: 1
							}
						});
					}
				}
			}
		}

		res.send("Done");
	} catch (err) {
		errorHandler({ err, res, req });
	}
});

export { Cron };
