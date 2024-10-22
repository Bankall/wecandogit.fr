import { useCookies } from "react-cookie";
import { useFetch } from "../hooks/useFetch";

import "./Account.css";
import { Suspense, lazy, useEffect } from "react";

import Loading from "../components/Loading";
import { useParams, useNavigate, NavLink } from "react-router-dom";

const AccountInfo = lazy(() => import("../components/AccountInfo"));
const DashboardListComponent = lazy(() => import("../components/DashboardListComponent"));
const MailEditor = lazy(() => import("../components/MailEditor"));

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
		if (params.action) {
			switch (params.action) {
				case "user-package":
					return <DashboardListComponent addLabel='Ajouter une formule' title='Formules' type='user_package' id_user={params.id} />;
				case "reservations":
					return <DashboardListComponent title='Reservations' type='reservation' id_user={params.id} allowedActions={[]} />;
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
				return <DashboardListComponent title='Les membres' type='user' allowedActions={["handleUserPackage", "handleUserReservation"]} />;
			case "slots":
				return <DashboardListComponent addLabel='Ajouter un créneau' title='Mes créneaux' type='slot' allowedActions={["delete", "modify", "book-reservation"]} />;
			case "past-slots":
				return <DashboardListComponent title='Mes créneaux passés' type='past_slot' allowedActions={[]} />;
			case "all-slots":
				return <DashboardListComponent title='Tout les créneaux' type='all_slot' allowedActions={[]} />;
			case "user-packages":
				return <DashboardListComponent title='Formules en attente de paiement' type='unpaid_user_package' allowedActions={["marked-package-as-paid"]} />;
			case "notifications":
				return <DashboardListComponent title='Notifications' type='notification' allowedActions={[]} />;
			case "all-user-packages":
				return <DashboardListComponent title='Toutes les formules' type='user_package' endpoint='all_user_package' allowedActions={["modify"]} />;
			case "payment-history":
				return <DashboardListComponent title='Historique de paiements' type='payment_history' allowedActions={[]} />;
			case "mail-composer":
				return <MailEditor />;
		}
	};

	return (
		<section className='account'>
			<div className='content'>
				<h2>Hello {cookies.username} !</h2>

				<div className='dashboard flex-row no-wrap'>
					<div className='menu'>
						<ul>
							<li>
								<NavLink to='/account/profile'>Mes Informations</NavLink>
							</li>
							<li>
								<NavLink to='/account/reservations'>Mes Reservations</NavLink>
							</li>
							<li>
								<NavLink to='/account/user_packages'>Mes Formules</NavLink>
							</li>

							{me.data?.result.is_trainer === 1 ? (
								<>
									<li>
										<a className='bold'>Administation</a>
									</li>
									<li>
										<NavLink to='/account/activities'>Nos Activités</NavLink>
									</li>
									<li>
										<NavLink to='/account/slots'>Mes Créneaux</NavLink>
									</li>
									<li>
										<NavLink to='/account/past-slots'>Mes Créneaux passés</NavLink>
									</li>
									<li>
										<NavLink to='/account/all-slots'>Tout les créneaux</NavLink>
									</li>
									<li>
										<NavLink to='/account/packages'>Mes Formules</NavLink>
									</li>
									<li>
										<NavLink to='/account/user-packages'>Formules en attente de paiement</NavLink>
									</li>
									<li>
										<NavLink to='/account/all-user-packages'>Toutes les formules</NavLink>
									</li>
									<li>
										<NavLink to='/account/users'>Membres</NavLink>
									</li>
									<li>
										<NavLink to='/account/payment-history'>Historique de paiements</NavLink>
									</li>
									<li>
										<NavLink to='/account/mail-composer'>Messages</NavLink>
									</li>
									<li>
										<NavLink to='/account/notifications'>Notifications</NavLink>
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
