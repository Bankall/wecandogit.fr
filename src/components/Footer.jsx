import { Link } from "react-router-dom";
import { useFetch } from "../hooks/useFetch";

import "./Footer.css";

export default function Footer() {
	const activities = useFetch("/get-activities-by-trainer");

	return (
		<footer>
			<section className='sitemap'>
				<ul>
					<li>
						<Link to='/a-propos'>Qui sommes nous</Link>
					</li>
					<li>
						<Link to='/educatrices'>Les educatrices</Link>
					</li>
					<li>
						<Link to='/cynologiste-kezako'>Un Cynologiste: Kézako?</Link>
					</li>
					<li>
						<Link to='/conditions-generales-vente'>Conditions générales de vente</Link>
					</li>
					<li>
						<Link to='/politique-confidentialite'>Politique de confidentialité</Link>
					</li>
				</ul>

				{activities.data?.trainers
					? activities.data.trainers.map(trainer => {
							return (
								<ul key={trainer.id}>
									<li className='no-list-style'>{trainer.name}</li>

									{trainer.activities.map(activity => {
										return (
											<li key={activity.id}>
												<Link to={`/activite/${activity.id}/${encodeURIComponent(activity.label.replace(/\s/gi, "-")).toLowerCase()}`}>{activity.label}</Link>
											</li>
										);
									})}
								</ul>
							);
					  })
					: null}
				<ul>
					<li>
						<Link to='/agenda'>Notre agenda</Link>
					</li>
					<li>
						<Link to='/reservations'>Mes réservation</Link>
					</li>
					<li>
						<Link to='/formules-et-tarifs'>Formules et tarifs</Link>
					</li>
					<li>
						<a href='https://docs.google.com/forms/d/e/1FAIpQLSeleVaqfG4q7Eb78hn87ur3-EdVo1CsOQat3OUCy99tfWLbvA/viewform' target='_blank'>
							Formulaire de contact
						</a>
					</li>
				</ul>
			</section>
			<div className='copyright'>© {new Date().getFullYear()} Wecandogit - Tous droits réservés.</div>
		</footer>
	);
}
