import * as React from "react";
import * as ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";

import Root from "./routes/Root";
import Home from "./routes/Home";
import Login from "./routes/Login";
import ErrorPage from "./routes/ErrorPage";
// import Education from "./routes/Education";
// import Account from "./routes/Account/Account";

// import Agenda from "./routes/Agenda";

import axios from "axios";
if (import.meta.env.VITE_API_ENDPOINT) {
	axios.defaults.baseURL = import.meta.env.VITE_API_ENDPOINT;
}

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
				path: "/agenda",
				lazy: () => import("./routes/Agenda")
			},
			{
				path: "/activities",
				lazy: () => import("./routes/Activities")
			},
			{
				path: "/account",
				lazy: () => import("./routes/Account")
			},
			{
				path: "/formules-et-tarifs",
				lazy: () => import("./routes/Pricing")
			}
		]
	},
	{
		path: "/login",
		element: <Login />,
		errorElement: <ErrorPage />
	}
]);

ReactDOM.createRoot(document.getElementById("root")).render(
	<React.StrictMode>
		<RouterProvider router={router} />
	</React.StrictMode>
);
