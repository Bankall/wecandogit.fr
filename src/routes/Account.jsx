import { useCookies } from "react-cookie";
import { useFetch } from "../hooks/useFetch";

import "./Account.css";
import { Suspense, lazy, useEffect } from "react";

import Loading from "../components/Loading";
import { useParams, useNavigate, NavLink } from "react-router-dom";

const AccountInfo = lazy(() => import("../components/AccountInfo"));
const DashboardListComponent = lazy(() => import("../components/DashboardListComponent"));

function Account() {
	const params = useParams();
	const navigate = useNavigate();
	const [cookies, setCookies] = useCookies();

	const me = useFetch("/me", me => {
		if (params.menu) {
			return;
		}
		if (me.result.is_trainer) {
			navigate("/account/slots");
		} else {
			navigate("/account/reservations");
		}
	});

	useEffect(() => {
		document.querySelector(".account").scrollIntoView();
	}, [params]);

	const switchRouter = () => {
		console.log(params);
		if (params.action) {
			switch (params.action) {
				case "user-package":
					return <DashboardListComponent addLabel='Ajouter une formule' title='Formules' type='user_package' id_user={params.id} />;
			}
		}

		switch (params.menu) {
			case "profile":
				return <AccountInfo />;
			case "reservations":
				return <DashboardListComponent title='Mes réservations' type='reservation' allowedActions={["delete-24"]} />;
			case "packages":
				return <DashboardListComponent addLabel='Ajouter une formule' title='Mes formules' type='package' />;
			case "user_packages":
				return <DashboardListComponent title='Mes formules' type='user_package' allowedActions={[]} />;
			case "activities":
				return <DashboardListComponent addLabel='Ajouter une activité' title='Nos activités' type='activity' />;
			case "users":
				return <DashboardListComponent title='Les membres' type='user' allowedActions={["handleUserPackage"]} />;
			case "slots":
				return <DashboardListComponent addLabel='Ajouter un créneau' title='Mes créneaux' type='slot' allowedActions={["delete", "modify", "book-reservation"]} />;
		}
	};

	return (
		<section className='account'>
			<div className='content'>
				<h2>Hello {cookies.username} !</h2>

				<div className='dashboard flex-row no-wrap'>
					<div className='menu'>
						<ul>
							{me.data?.result.is_trainer === 0 ? (
								<>
									<li>
										<NavLink to='/account/reservations'>Mes Reservations</NavLink>
									</li>
									<li>
										<NavLink to='/account/user_packages'>Mes Formules</NavLink>
									</li>
								</>
							) : null}

							<li>
								<NavLink to='/account/profile'>Mes Informations</NavLink>
							</li>

							{me.data?.result.is_trainer === 1 ? (
								<>
									<li>
										<NavLink to='/account/activities'>Nos Activités</NavLink>
									</li>
									<li>
										<NavLink to='/account/slots'>Mes Créneaux</NavLink>
									</li>
									<li>
										<NavLink to='/account/packages'>Mes Formules</NavLink>
									</li>
									<li>
										<NavLink to='/account/users'>Membres</NavLink>
									</li>
								</>
							) : null}
						</ul>
					</div>
					<div className='content widgets'>
						<div className='box'>
							<Suspense fallback={<Loading />}>{switchRouter()}</Suspense>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}

export { Account as Component };
