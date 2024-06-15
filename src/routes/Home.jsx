import { Link } from "react-router-dom";
import ActivityList from "../components/ActivityList";

import "./Home.css";

import Hero from "../components/Hero";
import Park from "../components/Park";
import Photos from "../components/Photos";
import Reviews from "../components/Reviews";

export default function Home() {
	return (
		<>
			<Hero />
			<section className='home'>
				<div className='widgets'>
					<div className='box'>
						<div className='title'>Prochaines activitées collectives</div>
						<div className='content'>
							<ActivityList endpoint='/get-next-collective-activities' />
						</div>
					</div>

					<div className='box'>
						<div className='title'>Prochains créneaux individuels</div>
						<div className='content'>
							<ActivityList endpoint='/get-next-individual-slots' />
						</div>
					</div>
				</div>

				<div className='center'>
					<Link to='/agenda'>
						<button className='big'>Voir tout</button>
					</Link>
				</div>
			</section>

			<Park />
			<Photos />
			<Reviews />
		</>
	);
}
