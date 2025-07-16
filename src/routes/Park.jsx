import { HeroLight } from "../components/HeroLight";
import { Activity } from "../components/Activity";

function Park() {
	return (
		<>
			<HeroLight>
				<h1>Parc&nbsp;en collectif</h1>
			</HeroLight>
			<section className='all-activities' id='nos-activites'>
				<div className='content'>
					<h2>Un espace sécurisé pour des rencontres sereines</h2>
					<p>Le parc en collectif permet aux chiens de se rencontrer dans un cadre structuré et sécurisé, sous la supervision d’éducatrices bienveillantes. Un moment pour explorer, jouer, interagir ou tout simplement observer.</p>
				</div>

				<div className='content flex-row no-wrap md-wrap align-normal width-50 margin-t-50 gap-50'>
					<Activity id='9' image='/assets/medias/DSCF1305.min.png' />
					<Activity id='14' image='/assets/medias/DSCF1305.min.png' />
					<Activity id='48' image='/assets/medias/DSCF1305.min.png' />
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

export { Park as Component };
