import { useCookies } from "react-cookie";
import { useFetch } from "../hooks/useFetch";

import "./Account.css";
import { Suspense, lazy, useState } from "react";

import Loading from "../components/Loading";
import { useLocation } from "react-router-dom";

const AccountInfo = lazy(() => import("../components/AccountInfo"));
const Bookings = lazy(() => import("../components/Bookings"));
const DashboardListComponent = lazy(() => import("../components/DashboardListComponent"));

export default function Account() {
	const location = useLocation();
	const [cookies, setCookies] = useCookies();
	const [currentMenu, setCurrentMenu] = useState(location.hash ? location.hash.slice(1) : "bookings");

	const me = useFetch("/me");

	const onMenuClick = event => {
		const name = event.target.getAttribute("name");
		if (!name) {
			return;
		}

		setCurrentMenu(name);
		window.location.hash = `#${name}`;
	};

	const switchRouter = param => {
		switch (param) {
			case "profile":
				return <AccountInfo />;
			case "packages":
				return <DashboardListComponent label='formule' type='package' />;
			case "activities":
				return <DashboardListComponent label='activité' type='activity' />;
			case "slots":
				return <DashboardListComponent label='créneau' type='slot' />;
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
							{me.data?.result.is_trainer === false ? (
								<li name='bookings' className={currentMenu === "bookings" ? "active" : ""}>
									Mes Reservations
								</li>
							) : null}
							<li name='profile' className={currentMenu === "profile" ? "active" : ""}>
								Mes Informations
							</li>

							{me.data?.result.is_trainer ? (
								<>
									<li name='activities' className={currentMenu === "activities" ? "active" : ""}>
										Mes Activités
									</li>
									<li name='slots' className={currentMenu === "slots" ? "active" : ""}>
										Mes Créneaux
									</li>
									<li name='packages' className={currentMenu === "packages" ? "active" : ""}>
										Mes Formules
									</li>
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
