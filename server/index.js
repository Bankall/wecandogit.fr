import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import requestIp from "request-ip";
import path from "path";
import Backend from "@bankall/mysql-backend";
import { ExpressAuth } from "@auth/express";

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
app.use(express.static(path.join(__dirname, "../app/build")));

const backend = new Backend({
	app,
	path: API_PATH
});

backend.start(() => {
	app.get("*", (req, res) => {
		res.sendFile(path.join(__dirname, "../app/build", "index.html"));
	});
});*/

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

app.get(`${API_PATH}/get-activities-by-trainer`, async (req, res) => {
	res.send({
		trainers: [
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
		]
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
