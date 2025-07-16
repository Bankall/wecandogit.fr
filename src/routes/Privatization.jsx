import { HeroLight } from "../components/HeroLight";
import { Activity } from "../components/Activity";

function Privatization() {
	return (
		<>
			<HeroLight>
				<h1>Privatisation&nbsp;du parc</h1>
			</HeroLight>
			<section className='all-activities' id='nos-activites'>
				<div className='content'>
					<h2>Un moment rien que pour vous</h2>
					<p>Offrez à votre chien un moment de liberté dans notre parc entièrement sécurisé. Que ce soit pour fêter son anniversaire, s'entraîner dans le calme ou simplement profiter d'un espace privatif, la privatisation est faite pour vous !</p>
				</div>

				<div className='content flex-row no-wrap md-wrap align-normal width-50 margin-t-50 gap-50'>
					<Activity id='19' image='/assets/medias/DSCF1305.min.png' />
					<Activity id='37' image='/assets/medias/DSCF1305.min.png' />
					<Activity id='36' image='/assets/medias/DSCF1305.min.png' />
				</div>

				<div className='flex-row margin-t-50 justify-center'>
					<div className='button small flex-no-grow'>
						<a href={`/activites`} className='button small'>
							Retour aux activités
						</a>
					</div>
				</div>
			</section>
		</>
	);
}

export { Privatization as Component };
