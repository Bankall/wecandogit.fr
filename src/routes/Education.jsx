import { HeroLight } from "../components/HeroLight";
import { Activity } from "../components/Activity";

function Education() {
	return (
		<>
			<HeroLight>
				<h1>Éducation &&nbsp;Rééducation</h1>
			</HeroLight>
			<section className='all-activities' id='nos-activites'>
				<div className='content'>
					<h2>Pourquoi ce suivi ?</h2>
					<p>Nous vous accompagnons dans la compréhension de votre chien et dans la construction d'une relation basée sur la coopération. Nos séances s’adaptent à votre binôme et à vos besoins : prévention, éducation, rééducation ou activités éducatives funs !</p>
				</div>

				<div className='content flex-row flex-wrap md-wrap align-normal width-50 margin-t-50 gap-50'>
					{/* <Activity id='13' image='/assets/medias/DSCF1305.min.png' link='soins-cooperatifs' />
					<Activity id='18' image='/assets/medias/DSCF1305.min.png' link='bilan-comportemental' />
					<Activity id='30' image='/assets/medias/DSCF1305.min.png' link='maternelle' />
					<Activity id='31' image='/assets/medias/DSCF1305.min.png' link='classe-ado-adulte' />
					<Activity id='32' image='/assets/medias/DSCF1305.min.png' link='atelier-educatif' />
					<Activity id='42' image='/assets/medias/DSCF1305.min.png' link='suivi-individuel' /> */}
					<Activity id='13' image='/assets/medias/soins_co.jpg' />
					<Activity id='18' image='/assets/medias/bilan.jpg' />
					<Activity id='30' image='/assets/medias/maternelle.jpg' />
					<Activity id='31' image='/assets/medias/ado.jpg' />
					<Activity id='32' image='/assets/medias/dog_dancing.jpg' />
					<Activity id='42' image='/assets/medias/suivi_individuel.jpg' />
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

export { Education as Component };
