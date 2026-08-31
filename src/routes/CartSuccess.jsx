import { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { useFetch } from "../hooks/useFetch";

const AUTO_REDIRECT_DELAY = 5;

export const Component = () => {
	const { id_trainer, session_id } = useParams();
	const { data } = useFetch({
		url: `/cart/get-session-status/${id_trainer}/${session_id}`,
		interval: 1
	});

	const stripe_url = `${import.meta.env.VITE_API_ENDPOINT}/cart/stripe-redirect/${id_trainer}/${session_id}`;
	const [countdown, setCountdown] = useState(AUTO_REDIRECT_DELAY);
	const [auto_redirect, setAutoRedirect] = useState(true);

	// Send the user to Stripe on its own unless they already clicked the button (the link opens in a new tab) or already paid
	useEffect(() => {
		if (!auto_redirect || (data && data.payment_status === "paid")) return;

		if (countdown <= 0) {
			window.location.href = stripe_url;
			return;
		}

		const timeout = setTimeout(() => setCountdown(current => current - 1), 1000);
		return () => clearTimeout(timeout);
	}, [auto_redirect, countdown, data, stripe_url]);

	return (
		<>
			<section className='cart' id='a-propos'>
				{data && data.payment_status === "paid" && <Navigate to={data.redirect} />}
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

							<a href={stripe_url} target='_blank' onClick={() => setAutoRedirect(false)}>
								<button className='margin-t-20'>
									Procéder au paiement
									{auto_redirect && countdown > 0 && ` (${countdown})`}
								</button>
							</a>
							{auto_redirect && <p className='margin-t-20'>Redirection automatique vers le paiement dans quelques secondes…</p>}
						</div>
					</div>
				</div>
			</section>
		</>
	);
};
