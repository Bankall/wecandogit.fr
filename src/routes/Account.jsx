import { useCookies } from "react-cookie";
import { useFetch } from "../hooks/useFetch";

import "./Account.css";
import { Suspense, lazy, useState } from "react";

import Loading from "../components/Loading";
import { useLocation } from "react-router-dom";

const AccountInfo = lazy(() => import("../components/AccountInfo"));
const Bookings = lazy(() => import("../components/Bookings"));
const Activities = lazy(() => import("../components/Activities"));
const Slots = lazy(() => import("../components/Slots"));
const Packages = lazy(() => import("../components/Packages"));

export default function Account() {
	const location = useLocation();
	const [cookies, setCookies] = useCookies();
	const [currentMenu, setCurrentMenu] = useState(location.hash ? location.hash.slice(1) : "bookings");

	const me = useFetch("/me");

	const onMenuClick = event => {
		const name = event.target.getAttribute("name");
		setCurrentMenu(name);
		window.location.hash = `#${name}`;
	};

	const switchRouter = param => {
		switch (param) {
			case "profile":
				return <AccountInfo />;
			case "packages":
				return <Packages />;
			case "activities":
				return <Activities />;
			case "slots":
				return <Slots />;
			case "bookings":
			default:
				return <Bookings />;
		}
	};

	return (
		<section className='account'>
			<div className='content'>
				<h2>Hello {cookies.username} !</h2>

				<div className='dashboard flex-row'>
					<div className='menu'>
						<ul onClick={onMenuClick}>
							{me.data?.result.is_trainer === false ? <li name='bookings'>Mes Reservations</li> : null}
							<li name='profile'>Mes Informations</li>

							{me.data?.result.is_trainer ? (
								<>
									<li name='activities'>Mes Activités</li>
									<li name='slots'>Mes créneaux</li>
									<li name='packages'>Mes Formules</li>
								</>
							) : null}
						</ul>
					</div>
					<div className='content widgets'>
						<div className='box'>
							<Suspense fallback={<Loading />}>{switchRouter(currentMenu)}</Suspense>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}

export { Account as Component };
