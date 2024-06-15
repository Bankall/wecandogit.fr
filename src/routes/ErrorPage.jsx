import { useRouteError, useNavigate, Link } from "react-router-dom";
import "./ErrorPage.css";

export default function ErrorPage() {
	const error = useRouteError();
	const navigate = useNavigate();

	console.error(error);

	return (
		<section id='error-page'>
			<div className='box'>
				<div className='title'>
					<i className='fa-regular fa-face-frown'></i> Oops!
				</div>
				<div className='content'>
					<p>
						<i>{error.status === 404 ? "Cette page n'existe pas." : "Désolé, une erreur innatendue s'est produite, merci de réessayer."}</i>
					</p>
					<p>
						<Link
							onClick={event => {
								event.preventDefault();
								navigate(-1);
							}}>
							<button>Retour en arrière</button>
						</Link>
					</p>
				</div>
			</div>
		</section>
	);
}
