import { Outlet } from "react-router-dom";

import Header from "/src/components/Header";
import Footer from "/src/components/Footer";

import "./Root.css";

export default function Home() {
	return (
		<>
			<Header />
			<main>
				<Outlet />
			</main>
			<Footer />
		</>
	);
}
