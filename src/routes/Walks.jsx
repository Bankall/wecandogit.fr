import { HeroLight } from "../components/HeroLight";
import { Activity } from "../components/Activity";
function Walks() {
	return (
		<>
			<HeroLight>
				<h1>Balades collectives &&nbsp;éducatives</h1>
			</HeroLight>
			<section className='all-activities' id='nos-activites'>
				<div className='content'>
					<h2>Pourquoi des balades ?</h2>
					<p>Les balades sont un excellent moyen de renforcer la relation humain-chien tout en offrant une dépense physique et mentale à votre compagnon. Elles permettent également de socialiser dans un cadre sécurisé et bienveillant.</p>
				</div>

				<div className='content flex-row no-wrap md-wrap align-normal width-50 margin-t-50 gap-50'>
					<Activity id='22' image='/assets/medias/DSCF1305.min.png' />
					{/* <Activity id='23' image='/assets/medias/DSCF1305.min.png' /> */}
					<Activity id='24' image='/assets/medias/DSCF1305.min.png' />
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

export { Walks as Component };
