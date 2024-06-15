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
						<Link to='/about-us'>Qui sommes nous</Link>
					</li>
					<li>
						<Link to='/about-us#trainer'>Les educatrices</Link>
					</li>
					<li>
						<Link to='/cynology'>Un Cynologiste: Kézako?</Link>
					</li>
					<li>
						<Link to='/privacy'>Politique de confidentialité</Link>
					</li>
				</ul>

				{activities.data
					? activities.data.trainers.map(trainer => {
							return (
								<ul key={trainer.id}>
									<li className='no-list-style'>{trainer.name}</li>

									{trainer.activities.map(activity => {
										return (
											<li key={activity.id}>
												<Link to={`/activity/${activity.id}/${activity.label}`}>{activity.label}</Link>
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
						<Link to='/booking'>Mes réservation</Link>
					</li>
					<li>
						<Link to='https://docs.google.com/forms/d/e/1FAIpQLSeleVaqfG4q7Eb78hn87ur3-EdVo1CsOQat3OUCy99tfWLbvA/viewform'>Formulaire de contact</Link>
					</li>
				</ul>
			</section>
			<div className='copyright'>© {new Date().getFullYear()} Wecandogit - Tous droits réservés.</div>
		</footer>
	);
}
