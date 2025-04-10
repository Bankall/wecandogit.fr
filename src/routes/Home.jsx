import { Link } from "react-router-dom";

import "./Home.css";

import Hero from "../components/Hero";
import HomeNumbers from "../components/HomeNumbers";
import Photos from "../components/Photos";
import Reviews from "../components/Reviews";

export default function Home() {
	return (
		<>
			<Hero />
			<HomeNumbers />
			<section className='quote font-0 flex-row no-wrap'>
				<div className='content'>
					<span>
						<span>
							Le secret de l'éducation réside dans le respect de l'élève
							<br />
							<img src='/assets/medias/signature.svg' className='signature' alt='quote' />
						</span>
					</span>
				</div>
			</section>
			<section className='activities'>
				<div className='content'>
					<h3>
						Pour partager un bon moment avec son chien, parfaire son éducation ou améliorer un problème de comportement grâce au <b>renforcement positif</b>
					</h3>
					<h4>
						Quelque soit votre objectif, <b>We Can Dog It</b> propose sûrement l'activité qui vous correspond
					</h4>

					<div className='flex-row space-around'>
						<div className='item'>
							<div>
								<img src='/assets/medias/education.png' alt='education' />
							</div>
							<div className='center'>EDUCATION</div>
							<Link to='/activites/Education%20%2F%20Rééducation'>
								<div className='button'>
									En savoir <b>+</b>
								</div>
							</Link>
						</div>

						<div className='item'>
							<div>
								<img src='/assets/medias/sport.png' alt='education' />
							</div>
							<div className='center'>SPORT</div>
							<Link to='/activites/Sports%20canins'>
								<div className='button'>
									En savoir <b>+</b>
								</div>
							</Link>
						</div>

						<div className='item'>
							<div>
								<img src='/assets/medias/nosework.png' alt='education' />
							</div>
							<div className='center'>DETECTION</div>
							<Link to='/activites/Sports%20canins'>
								<div className='button'>
									En savoir <b>+</b>
								</div>
							</Link>
						</div>

						<div className='item'>
							<div>
								<img src='/assets/medias/park.png' alt='education' />
							</div>
							<div className='center'>NOTRE PARC</div>
							<Link to='/activites/Parc%20en%20collectif'>
								<div className='button'>
									En savoir <b>+</b>
								</div>
							</Link>
						</div>
					</div>
				</div>
			</section>
			<Photos />
			<Reviews />
			<section className='contact font-0 flex-row no-wrap'>
				<img src='/assets/medias/Genko.png' alt='Contact Us button' style={{ maxHeight: "200px", position: "relative", zIndex: 1 }} />
				<a href='mailto:contact.wecandogit@gmail.com' className='no-shrink' target='_blank'>
					<button>CONTACTE-NOUS</button>
				</a>
			</section>
		</>
	);
}
