export default function Park() {
	return (
		<section className='park light'>
			<div className='content'>
				<h2>Le parc de loisirs et d'éducation</h2>
				<p>Situé aux Mesneux, notre parc canin de 4000m² est un espace de rencontre, où les chiens peuvent venir se dépenser physiquement et mentalement, rencontrer leurs congénères et apprendre en toute sécurité. Un lieu où les maîtres peuvent échanger entre eux ainsi qu'avec une éducatrice comportementaliste (l'une de nous est toujours présente). Un espace réservé à la pratique du sport, un espace dédié aux loisirs, et un espace dédié aux cours pour les chiots ainsi qu'aux petits chiens.</p>

				<div className='location'>
					<div className='map'>
						<iframe width='100%' height='100%' src='https://www.google.com/maps/embed/v1/place?key=AIzaSyDtFaGeGR5rB75OjS-F5M1ZQn8xmrxkrGo&q=place_id:ChIJ8yRNHrKz7iUReSJcT90Ok7w&zoom=13'></iframe>
					</div>
					<div className='spacer'></div>
					<div className='details'>
						<div className='row'>
							<h3>Adresse:</h3>
							<p>
								Parc We Can Dog It
								<br />
								Les Sables, <br />
								51370 Les Mesneux
							</p>
						</div>
						<div className='row'>
							<h3>Téléphone: </h3>
							<p>
								Chloe Ternier: <a href='tel:+33 6 88 47 78 01'>+33 6 88 47 78 01</a>
							</p>
							<p>
								Elodie Decouleur : <a href='tel:++33 6 44 28 79 32'>+33 6 44 28 79 32</a>
							</p>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
