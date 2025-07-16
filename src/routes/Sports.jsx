import { HeroLight } from "../components/HeroLight";
import { Activity } from "../components/Activity";
import { Link } from "react-router-dom";

function Sports() {
	return (
		<>
			<HeroLight>
				<h1>Sports canins</h1>
			</HeroLight>
			<section className='all-activities' id='nos-activites'>
				<div className='content'>
					<h2>Pourquoi pratiquer un sport avec son chien ?</h2>
					<p>Les sports canins renforcent la complicité, améliorent la confiance et permettent une dépense physique et mentale adaptée. Nos séances sont accessibles à tous les binômes, sans objectif de compétition, dans un esprit ludique et bienveillant.</p>
				</div>

				<div className='content flex-row flex-wrap md-wrap align-normal width-50 margin-t-50 gap-50'>
					<Activity id='10' image='/assets/medias/DSCF1305.min.png' link='nosework' />
					<Activity id='28' image='/assets/medias/DSCF1305.min.png' link='agility-hoopers' />
					<Activity id='12' image='/assets/medias/DSCF1305.min.png' link='mantrailing' />
					<Activity id='52' image='/assets/medias/IMG_1639-2.jpg' link='cani-paddle' />
				</div>

				<div className='flex-row margin-t-50 justify-center'>
					<div className='button small flex-no-grow'>
						<Link to={`/activites`} className='button small'>
							Retour aux activités
						</Link>
					</div>
				</div>
			</section>
		</>
	);
}

export { Sports as Component };
