import { useRouteError, useNavigate, Link, useSearchParams } from "react-router-dom";
import { useEffect } from "react";

import axios from "axios";

export default function ErrorPage() {
	const error = useRouteError();
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();

	if (searchParams.get("reload") === null) {
		window.location.replace("?reload");
	}
	const post = async () => {
		const errorMessage = error.error ? error.error.toString() : error.toString();
		try {
			await axios.post("/log-error", {
				error: errorMessage,
				originalUrl: window.location.pathname
			});
		} catch (err) {}

		if (errorMessage && errorMessage.match(/Failed to fetch/)) {
			window.location.reload(true);
		}
	};

	useEffect(() => {
		post();
	}, [error]);

	return (
		<section className='flex-row'>
			<div className='box big-box'>
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
