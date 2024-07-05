import { useCookies } from "react-cookie";
import { useFetch } from "../hooks/useFetch";

import "./Account.css";
import { Suspense, lazy, useState, useEffect } from "react";

import Loading from "../components/Loading";
import { useLocation } from "react-router-dom";

const AccountInfo = lazy(() => import("../components/AccountInfo"));
const DashboardListComponent = lazy(() => import("../components/DashboardListComponent"));

function Account() {
	const location = useLocation();
	const [cookies, setCookies] = useCookies();
	const [currentMenu, setCurrentMenu] = useState(false);

	const me = useFetch("/me", me => {
		if (me.result.is_trainer) {
			setCurrentMenu("slots");
		} else {
			setCurrentMenu("reservations");
		}
	});

	const onMenuClick = event => {
		const name = event.target.getAttribute("name");
		if (!name) {
			return;
		}

		setCurrentMenu(name);
		window.location.hash = `#${name}`;
	};

	useEffect(() => {
		const hash = location.hash.slice(1);
		if (hash) {
			setCurrentMenu(decodeURIComponent(hash));
			document.querySelector(".account").scrollIntoView({ behavior: "smooth" });
		}
	}, [location]);

	const switchRouter = param => {
		switch (param) {
			case "profile":
				return <AccountInfo />;
			case "reservations":
				return <DashboardListComponent title='Mes réservations' type='reservation' allowedActions={["delete"]} />;
			case "packages":
				return <DashboardListComponent addLabel='Ajouter une formule' title='Mes formules' type='package' />;
			case "activities":
				return <DashboardListComponent addLabel='Ajouter une activité' title='Nos activités' type='activity' />;
			case "slots":
				return <DashboardListComponent addLabel='Ajouter un créneau' title='Mes créneaux' type='slot' />;
		}
	};

	return (
		<section className='account'>
			<div className='content'>
				<h2>Hello {cookies.username} !</h2>

				<div className='dashboard flex-row no-wrap'>
					<div className='menu'>
						<ul onClick={onMenuClick}>
							{me.data?.result.is_trainer === 0 ? (
								<li name='reservations' className={currentMenu === "reservations" ? "active" : ""}>
									Mes Reservations
								</li>
							) : null}

							<li name='profile' className={currentMenu === "profile" ? "active" : ""}>
								Mes Informations
							</li>

							{me.data?.result.is_trainer ? (
								<>
									<li name='activities' className={currentMenu === "activities" ? "active" : ""}>
										Nos Activités
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
