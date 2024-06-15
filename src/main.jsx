import * as React from "react";
import * as ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";

import Root from "./routes/Root";

import Home from "./routes/Home";
import Education from "./routes/Education";
import ErrorPage from "./routes/ErrorPage";

import Account from "./routes/Account/Account";
import Login from "./routes/Account/Login";

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
				path: "/account",
				element: <Account />
			},
			{
				path: "/education",
				element: <Education />
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
