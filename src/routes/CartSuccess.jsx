import { useParams } from "react-router-dom";

export const Component = () => {
	const { id_trainer, session_id } = useParams();

	return (
		<>
			<section className='cart' id='a-propos'>
				<div className='content'>
					<h2>Confirmation</h2>
					<div className='widgets flex-col center'>
						<div className='box' style={{ maxWidth: "800px" }}>
							<div className='row flex-col flex-stretch'>
								<p>
									<b>✅ Votre demande est bien enregistrée</b>
								</p>
								<p>
									<b>🎉 Tout est déjà pris en compte avant le paiement :</b>
								</p>

								<p>📅 Vos créneaux sont réservés (si vous en avez sélectionné)</p>
								<p>🎟️ Votre formule est réservée (si vous en avez acheté une)</p>

								<p className='margin-b-20'>Vous pouvez maintenant procéder au paiement en toute sérénité.</p>
							</div>

							<div className='row flex-col flex-stretch'>
								<p>
									<b>⚠️ Important</b>
								</p>

								<p>Même si le paiement échoue ou si la page se recharge :</p>

								<p>
									<b>👉 Ne refaites pas votre réservation ou votre achat.</b>
								</p>
								<p>Ce que vous venez de sélectionner est déjà enregistré dans votre compte.</p>

								<p className='margin-b-20'>En cas de problème de paiement, veuillez nous contacter.</p>
							</div>

							<a href={`${import.meta.env.VITE_API_ENDPOINT}/cart/stripe-redirect/${id_trainer}/${session_id}`} target='_blank'>
								<button className='margin-t-20'>Procéder au paiement</button>
							</a>
						</div>
					</div>
				</div>
			</section>
		</>
	);
};
