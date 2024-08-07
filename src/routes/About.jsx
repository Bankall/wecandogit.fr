import { useEffect } from "react";
import { useFetch } from "../hooks/useFetch";

import { Navigation } from "swiper/modules";
import Swiper from "swiper";

import "swiper/css";
import "swiper/css/navigation";

import "./About.css";
import { useLocation } from "react-router-dom";
import { Interweave } from "interweave";

function About() {
	const trainers = useFetch("/get-trainers-description", () => {});
	const location = useLocation();

	useEffect(() => {
		if (!trainers.data?.trainers) {
			return;
		}

		new Swiper(".swiper", {
			modules: [Navigation],
			navigation: {
				nextEl: ".swiper-button-next",
				prevEl: ".swiper-button-prev"
			},
			loop: true,
			slidesPerView: "auto",
			spaceBetween: 10,
			autoplay: {
				delay: 5000
			}
		});
	}, [trainers]);

	useEffect(() => {
		const pathname = location.pathname ? location.pathname.slice(1) : "";
		const anchor = document.querySelector(`#${pathname}`);

		const timeout = setTimeout(() => {
			if (anchor) {
				anchor.scrollIntoView({ behavior: "smooth" });
			}
		}, 200);

		return () => {
			clearTimeout(timeout);
		};
	}, [location]);

	return (
		<>
			<section className='about-us' id='a-propos'>
				<div className='content'>
					<h2>We Can Dog It</h2>
					<div className='flex-row no-wrap'>
						<p>
							C'est la réunion de deux cynologistes qui partagent les mêmes valeurs : accompagner la relation homme-chien en s'appuyant sur la coopération et la motivation du chien comme de son humain, développer le potentiel de chacun en utilisant des méthodes bienveillantes et respectueuses, et se former encore et toujours pour accompagner ces binômes le mieux possible.
							<br />
							Lorsque Chloé était au début de sa formation de Cynologiste, elle a eu la chance de rencontrer Elodie lors d'une balade entre chiens. De cette balade organisée via Instagram est née une relation basée sur l'échange, le partage et la bienveillance. <br />
							De discussions en discussions, elles se sont rendu compte qu'elles partageaient le même rêve : ouvrir un centre de loisirs pour nos amis les chiens, où chaque binôme pourrait venir passer un moment ludique et agréable, loin de toutes notions de compétition ou de pression. Un lieu dédié à l'éducation, au loisirs, au sport et aux rencontres.
							<br />
							<br /> C'est donc tout naturellement qu'elles ont décidé d'unir leurs forces et leurs compétences pour réaliser ce rêve.
						</p>
						<div className='font-0 ar-3-4'>
							<img src='/assets/medias/769540_0a679b20f37a49eca4ee1712fc88bcc7~mv2.jpg' alt='Photo des deux éducatrices' />
						</div>
					</div>
				</div>
			</section>

			<section className='trainers' id='educatrices'>
				<div className='content'>
					<h2>Les Educatrices</h2>

					<div className='swiper'>
						<div className='swiper-wrapper'>
							{trainers.data?.trainers
								? trainers.data?.trainers.map(trainer => {
										return (
											<div className='swiper-slide' key={trainer.id}>
												<div className='box'>
													<div className='title'>{trainer.name}</div>
													<div className='content flex-row no-wrap'>
														<img src={trainer.photo} />
														<pre>{trainer.description}</pre>
													</div>

													<div className='content grid'>
														<Interweave content={trainer.training} />
													</div>
												</div>
											</div>
										);
								  })
								: null}
						</div>
						<div className='swiper-button-prev'></div>
						<div className='swiper-button-next'></div>
					</div>
				</div>
			</section>
		</>
	);
}

export { About as Component };
