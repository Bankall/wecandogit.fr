import { Link } from "react-router-dom";

export default function Login() {
	return (
		<section id='login' className='box'>
			<h1>Se connecter</h1>
			<h2>
				Vous n'avez pas de compte ? <Link to='register'>S'inscrire</Link>
			</h2>
		</section>
	);
}
