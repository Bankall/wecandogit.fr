import { useFetch } from "../hooks/useFetch";

import "swiper/css";
import "swiper/css/navigation";

import { HeroLight } from "../components/HeroLight";

function About() {
	const trainers = useFetch("/get-trainers-description", () => {});

	return (
		<>
			<HeroLight />
			<section className='about-us' id='a-propos'>
				<div className='content'>
					<h2>Qui sommes-nous ?</h2>
					<div className=''>
						<p>We can dog it, c'est nous : deux cynologistes passionnées, réunies par les mêmes valeurs : accompagner la relation humain-chien avec bienveillance, coopération et respect.</p>
						<br />
						<p>C’est au détour d’une balade canine, organisée via Instagram, que nos chemins se sont croisés. Très vite, une belle complicité s’est installée, nourrie par nos échanges et notre passion commune. Et puis l’évidence s’est imposée : nous rêvions toutes les deux d’un lieu bienveillant où chaque duo humain-chien pourrait s’épanouir librement, loin de toute pression, dans le respect des besoins et du rythme de chacun.</p>
						<br />
						<p>C’est donc tout naturellement que nous avons décidé d’unir nos forces pour fonder un centre de loisirs canin. Un espace pour apprendre, jouer, se reconnecter et grandir ensemble.</p>
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
