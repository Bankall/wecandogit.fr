import { Router } from "express";
import MailSender from "../../lib/mail-sender/index.cjs";
import { errorHandler } from "../../lib/utils.js";
let backend;

const router = Router();
router.route("/ping").get((req, res) => {
	res.send("pong");
});

const Cron = _backend => {
	backend = _backend;
	return router;
};

const formatDate = date => {
	date = new Date(date.replace(/-/g, "/"));
	return date.toLocaleString().slice(0, 16);
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
			const content = `<p>Bonjour ${reminder.user},</p><p>Ceci est un rappel pour votre réservation de ${reminder.activity} le ${reminder.date} avec ${reminder.dog}.</p><p>A bientôt !</p>`;

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

export { Cron };
