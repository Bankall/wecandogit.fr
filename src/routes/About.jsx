import { useFetch } from "../hooks/useFetch";

import "swiper/css";
import "swiper/css/navigation";

import { HeroLight } from "../components/HeroLight";
import { Interweave } from "interweave";

function About() {
	const trainers = useFetch("/get-trainers-description", () => {});

	return (
		<>
			<HeroLight />
			<section className='about-us' id='a-propos'>
				<div className='content flex-row no-wrap md-wrap justify-center width-50 gap-50'>
					<img src='/assets/medias/B9731425475Z.1_20220709163335_000+GVGKR5I8A.1-0.jpg' className='squared-picture align-self-center' />
					<img src='/assets/medias/769540_0a679b20f37a49eca4ee1712fc88bcc7~mv2.jpg' className='squared-picture align-self-center' />
				</div>
				<div className='content margin-t-50'>
					<h2>Qui sommes-nous ?</h2>
					<div className=''>
						<p>
							<b>We can dog it, c'est nous, deux cynologistes passionnées, réunies par les mêmes valeurs :</b> accompagner la relation humain-chien avec bienveillance, coopération et respect.
						</p>
						<br />
						<p>
							C’est au détour d’une balade canine, organisée via Instagram, que nos chemins se sont croisés. Très vite, une <b>belle complicité</b> s’est installée, nourrie par nos échanges et notre <b>passion commune</b>. Et puis l’évidence s’est imposée : nous rêvions toutes les deux d’un <b>lieu bienveillant</b> où chaque duo humain-chien pourrait s’épanouir librement, loin de toute pression, dans le respect des besoins et du rythme de chacun.
						</p>
						<br />
						<p>
							C’est donc tout naturellement que nous avons décidé d’unir nos forces pour fonder un <b>centre de loisirs canin</b>. Un espace pour apprendre, jouer, se reconnecter et grandir ensemble.
						</p>
					</div>

					<div className='flex-row no-wrap align-normal width-50 margin-t-50 gap-50 trainers'>
						{trainers.data?.trainers
							? trainers.data?.trainers.map(trainer => {
									return (
										<div className='box' key={trainer.id}>
											<img src={trainer.photo} className='profil-picture' />
											<div className='title'>{trainer.name}</div>
											<div className='content flex-row no-wrap left'>
												<pre>{trainer.description}</pre>
											</div>
										</div>
									);
							  })
							: null}
					</div>
				</div>
			</section>
		</>
	);
}

export { About as Component };
