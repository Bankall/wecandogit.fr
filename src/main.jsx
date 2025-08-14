import * as React from "react";
import * as ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider, redirect, ScrollRestoration } from "react-router-dom";
import "./index.css";

import Root from "./routes/Root";
import Home from "./routes/Home";
import Login from "./routes/Login";
import ErrorPage from "./routes/ErrorPage";

import axios from "axios";

if (import.meta.env.VITE_API_ENDPOINT) {
	axios.defaults.baseURL = import.meta.env.VITE_API_ENDPOINT;
}

axios.defaults.withCredentials = true;

const isLoggedIn = async () => {
	try {
		const res = await fetch(`${import.meta.env.VITE_API_ENDPOINT}/is-logged-in`, { credentials: "include" });
		const json = await res.json();

		return !!json.ok;
	} catch (err) {
		console.error(err);
		return false;
	}
};

const router = createBrowserRouter([
	{
		path: "/",
		element: <Root />,
		errorElement: <ErrorPage />,
		children: [
			{
				path: "/",
				element: <Home />
			},
			{
				path: "/a-propos",
				lazy: async () => import("./routes/About")
			},
			{
				path: "/educatrices",
				lazy: async () => import("./routes/About")
			},
			{
				path: "/cynologiste-kezako",
				lazy: async () => import("./routes/Cynologyst")
			},
			{
				path: "/conditions-generales-vente",
				lazy: async () => import("./routes/GTC")
			},
			{
				path: "/politique-confidentialite",
				lazy: async () => import("./routes/Privacy")
			},
			{
				path: "/agenda/:year?/:week?",
				lazy: () => import("./routes/Agenda")
			},
			{
				path: "/activites",
				children: [
					{
						path: "",
						lazy: () => import("./routes/Activities")
					},
					{
						path: "balades",
						lazy: () => import("./routes/Walks")
					},
					{
						path: "privatisations",
						lazy: () => import("./routes/Privatization")
					},
					{
						path: "loisirs",
						lazy: () => import("./routes/Leisures")
					},
					{
						path: "privatisation-parc",
						lazy: () => import("./routes/Activities")
					},
					{
						path: "sports-canins",
						children: [
							{
								path: "",
								lazy: () => import("./routes/Sports")
							},
							{
								path: "agility-hoopers",
								lazy: () => import("./routes/AgilityHoopers")
							},
							{
								path: "mantrailing",
								lazy: () => import("./routes/Mantrailing")
							},
							{
								path: "nosework",
								lazy: () => import("./routes/Nosework")
							},
							{
								path: "cani-paddle",
								lazy: () => import("./routes/CaniPaddle")
							}
						]
					},
					{
						path: "education-reeducation",
						children: [
							{
								path: "",
								lazy: () => import("./routes/Education")
							},
							{
								path: "soins-cooperatifs",
								lazy: () => import("./routes/Care")
							},
							{
								path: "bilan-comportemental",
								lazy: () => import("./routes/Assessement")
							},
							{
								path: "maternelle",
								lazy: () => import("./routes/Kindergarten")
							},
							{
								path: "classe-ado-adulte",
								lazy: () => import("./routes/AdultClass")
							},
							{
								path: "atelier-educatif",
								lazy: () => import("./routes/Workshop")
							},
							{
								path: "suivi-individuel",
								lazy: () => import("./routes/IndividualTraining")
							}
						]
					}
				]
			},
			{
				path: "/activites/:menu",
				lazy: () => import("./routes/ListAllActivities")
			},
			{
				path: "/nos-eleves",
				lazy: () => import("./routes/Students")
			},
			{
				path: "/formules-et-tarifs/:menu?",
				lazy: () => import("./routes/Packages")
			},
			{
				path: "/cart",
				lazy: () => import("./routes/Cart")
			},
			{
				path: "/account",
				children: [
					{
						path: "package/create/",
						lazy: () => import("./routes/Account/PackageCreate")
					},
					{
						path: "package/edit/:id",
						lazy: () => import("./routes/Account/PackageEdit")
					},
					{
						path: "user_package/create/:id_user",
						lazy: () => import("./routes/Account/UserPackageCreate")
					},
					{
						path: "user_package/edit/:id",
						lazy: () => import("./routes/Account/UserPackageEdit")
					},
					{
						path: "activity/create/",
						lazy: () => import("./routes/Account/ActivityCreate")
					},
					{
						path: "activity/edit/:id",
						lazy: () => import("./routes/Account/ActivityEdit")
					},
					{
						path: "slot/create/",
						lazy: () => import("./routes/Account/SlotCreate")
					},
					{
						path: "slot/edit/:id",
						lazy: () => import("./routes/Account/SlotEdit")
					},
					{
						path: "slot/book/:id",
						lazy: () => import("./routes/Account/SlotBook")
					},
					{
						path: "dog/create/",
						lazy: () => import("./routes/Account/DogCreate")
					},
					{
						path: "dog/edit/:id",
						lazy: () => import("./routes/Account/DogEdit")
					},
					{
						path: "user/edit/:id",
						lazy: () => import("./routes/Account/UserEdit")
					},
					{
						path: ":menu?/:action?/:id?",
						lazy: () => import("./routes/Account"),
						loader: async () => {
							const ok = await isLoggedIn();
							return !ok ? redirect("/login") : null;
						}
					}
				]
			},
			{
				path: "/debug",
				lazy: () => import("./routes/Debug")
			}
		]
	},
	{
		path: "/login/:redirect?",
		element: <Login />,
		errorElement: <ErrorPage />,
		loader: async ({ params }) => {
			const ok = await isLoggedIn();
			return ok ? redirect(params.redirect ? `/${params.redirect}` : "/account") : null;
		}
	},
	{
		path: "/reset-password",
		errorElement: <ErrorPage />,
		children: [
			{
				path: "",
				lazy: () => import("./routes/ResetPassword")
			},
			{
				path: "new-password/",
				lazy: () => import("./routes/GenerateNewPassword")
			}
		]
	}
]);

ReactDOM.createRoot(document.getElementById("root")).render(
	<React.StrictMode>
		<RouterProvider router={router} />
	</React.StrictMode>
);
