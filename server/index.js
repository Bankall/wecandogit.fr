import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import requestIp from "request-ip";
import path from "path";
import { fileURLToPath } from "url";
import Backend from "@bankall/mysql-backend";
import { ExpressAuth } from "@auth/express";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3030;
const API_PATH = "/api/v1";

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(requestIp.mw());
app.use(express.static(path.join(__dirname, "../dist")));
app.use("/auth/*", ExpressAuth({ providers: [] }));

/*
const backend = new Backend({
	app,
	path: API_PATH
});

backend.start(() => {
	app.get("*", (req, res) => {
		res.sendFile(path.join(__dirname, "../app/build", "index.html"));
	});
});*/

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

app.get(`${API_PATH}/is-logged-in`, async (req, res) => {
	res.send({
		ok: Math.random() > 0.5
	});
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

J'ai obtenu mon diplôme de Cynologiste en juillet 2022.`
		},
		{
			id: 345,
			name: "Elodie Decouleur",
			description: `J'ai été commerciale durant 8 ans, avant d'être pendant 2 ans chef de publicité. En septembre 2020, j'ai décidé d'arrêter mon activité salariée, afin de me consacrer pleinement à mon activité secondaire, l'éducation et la rééducation des chiens de compagnie. 

Je suis passionnée de chiens depuis toujours, mais c'est en 2016 que j'ai validé le diplôme d'éducatrice comportementaliste, Cynologiste et que j'ai ouvert Amity Dog. 

J'accompagne depuis les familles et les associations de protection animale, en les aidant à mieux comprendre les chiens.`
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

app.get(`${API_PATH}/get-cart-item`, async (req, res) => {
	const count = parseInt(Math.random() * 3);
	res.send({ count });
});

app.get(`${API_PATH}/is-logged-in`, async (req, res) => {
	const result = Math.random() > 0.3;
	res.send({ result });
});

app.listen(PORT, () => {
	console.log(`App listening on port ${PORT}!`);
});
