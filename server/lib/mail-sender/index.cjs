const { SESClient, SendRawEmailCommand } = require("@aws-sdk/client-ses");
const client = new SESClient({ region: "eu-west-1", profile: "bankall" });

const MailComposer = require("nodemailer/lib/mail-composer");

const fs = require("fs");

class Mail {
	constructor() {}

	replaceMacros(text, values) {
		for (const [key, value] of Object.entries(values)) {
			text = text.replace(`{{${key}}}`, value);
		}

		text = text.replace(/{{.*?}}/g, "");

		return text;
	}

	getMailContent(template, macros) {
		const HTML_TEMPLATE = fs.readFileSync(`${__dirname}/templates/template.html`, "utf8").toString();
		const TXT_TEMPLATE = fs.readFileSync(`${__dirname}/templates/template.txt`, "utf8").toString();

		const body = {
			html: this.replaceMacros(HTML_TEMPLATE, macros),
			txt: this.replaceMacros(TXT_TEMPLATE, macros)
		};

		return body;
	}

	send({ email, subject, template, macros }) {
		return new Promise(async (resolve, reject) => {
			const body = this.getMailContent(template, macros);
			const mail = new MailComposer({
				from: "We Can Dog It <contact@wecandogit.com>",
				replyTo: "contact.wecandogit@gmail.com",
				to: email,
				subject,
				text: body.txt,
				html: body.html
			});

			mail.compile().build(async (err, message) => {
				try {
					if (err) {
						throw err;
					}

					const input = {
						RawMessage: {
							Data: message
						},
						Tags: [{ Name: "Service", Value: "Mail" }]
					};

					const command = new SendRawEmailCommand(input);
					await client.send(command);

					resolve({ ok: true });
				} catch (err) {
					console.log(err);
					reject(err);
				}
			});
		});
	}
}

module.exports = new Mail();
