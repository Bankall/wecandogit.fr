import { Link } from "react-router-dom";
import { HeroLight } from "../components/HeroLight";

function Activities() {
	return (
		<>
			<HeroLight />
			<section className='all-activities' id='nos-activites'>
				<div className='content'>
					<h2>Nos activités</h2>

					<div className='flex-row align-normal gap-25'>
						<Link to='/activites/sports-canins' className='activity-card'>
							<img src='/assets/medias/sports_canins.jpg' alt='Activities' />
							<div className='flex-col'>
								<h3>Sports canins</h3>
								<p>Nosework, mantrailing, agility, frisbee, cani-rando, cani-paddle… seul ou en duo, débutant ou passionné.</p>
								<span className='button small align-self-left margin-t-20'>En savoir plus</span>
							</div>
						</Link>

						<Link to='/activites/education-reeducation' className='activity-card'>
							<img src='/assets/medias/education.jpg' alt='Activities' />
							<div className='flex-col'>
								<h3>Éducation & Rééducation</h3>
								<p>Soins coopératifs, bilan comportemental, maternelle du chiot, cours ados/adultes, ateliers éducatifs & dog dancing.</p>
								<span className='button small align-self-left margin-t-20'>En savoir plus</span>
							</div>
						</Link>

						<Link to='/activites/parc-collectif' className='activity-card'>
							<img src='/assets/medias/parc_co.jpg' alt='Activities' />
							<div className='flex-col'>
								<h3>Parc en collectif</h3>
								<p>Rencontres libres par affinités, pour petits ou grands gabarits. Une première approche progressive pour tous.</p>
								<span className='button small align-self-left margin-t-20'>En savoir plus</span>
							</div>
						</Link>

						<Link to='/activites/balades' className='activity-card'>
							<img src='/assets/medias/balades.jpg' alt='Activities' />
							<div className='flex-col'>
								<h3>Balades</h3>
								<p>Collectives, éducatives ou pour chiens calmes, pour renforcer la socialisation et le plaisir de se promener ensemble.</p>
								<span className='button small align-self-left margin-t-20'>En savoir plus</span>
							</div>
						</Link>

						{/* <Link to='/activites/privatisations' className='activity-card'>
							<img src='/assets/medias/privatisation.jpg' alt='Activities' />
							<div className='flex-col'>
								<h3>Privatisation du parc</h3>
								<p>Canniversaire, accès individuel ou terrain de sport à louer pour un moment rien qu’à vous !</p>
								<span className='button small align-self-left margin-t-20'>En savoir plus</span>
							</div>
						</Link> */}
					</div>
				</div>
			</section>
		</>
	);
}

export { Activities as Component };
