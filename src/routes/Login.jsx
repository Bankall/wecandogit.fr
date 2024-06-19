import { Link, useNavigate, useLocation } from "react-router-dom";
import { useFetch } from "../hooks/useFetch";
import { FormikWrapper } from "../utils/utils.formik";

import axios from "axios";

import "./Login.css";
export default function Login() {
	const GoogleOAuthUrl = useFetch("/auth/oauth/get-google-redirect-url");
	const { hash } = useLocation();
	const navigate = useNavigate();

	const loginForm = [
		{
			name: "email",
			type: "string",
			label: "Adresse email",
			uitype: "email"
		},
		{
			name: "password",
			type: "string",
			label: "Mot de passe",
			uitype: "password"
		}
	];

	const registerForm = [...loginForm];
	registerForm.push(
		{
			name: "firstname",
			type: "string",
			label: "Prénom",
			uitype: "text"
		},
		{
			name: "lastname",
			type: "string",
			label: "Nom",
			uitype: "text"
		},
		{
			name: "phone",
			type: "string",
			label: "Numéro de téléphone",
			uitype: "tel"
		}
	);

	return (
		<section className='flex-row'>
			<div className='box big-box'>
				<div className='title'>
					<i className='fa-regular fa-user'></i> Se connecter
				</div>
				<div className='content'>
					<div className={`google-button ${GoogleOAuthUrl.data ? "" : " disabled"}`}>
						<Link to={GoogleOAuthUrl.data}>
							<button>
								<img src='https://www.svgrepo.com/show/475656/google-color.svg' loading='lazy' alt='google logo' />
								<span>Se connecter avec Google</span>
							</button>
						</Link>
					</div>
					<div className='login-separator'></div>

					<div className='box'>
						<FormikWrapper
							options={{
								data: hash === "#register" ? registerForm : loginForm,
								use_placeholders: true
							}}
							submitText={hash === "#register" ? "S'enregistrer" : "Se connecter"}
							onSubmit={async ({ values, setSubmitionError }) => {
								setSubmitionError("");

								try {
									const response = await axios.post(hash === "#register" ? "/create-user" : "/auth/login", values, { withCredentials: true });

									if (response.data.error) throw response.data.error;
									if (response.data.ok) {
										setTimeout(() => {
											navigate(response.data.location || "/account");
										}, 500);
									}
								} catch (err) {
									const errMessage = err.message || err;
									setSubmitionError(errMessage);
								}
							}}
						/>

						{hash === "#register" ? (
							<p>
								Déjà inscrit ? <Link to='#'>Connectez-vous</Link>
							</p>
						) : (
							<>
								<p>
									Mot de passe oublié ? <Link to='/reset-password'>Cliquez ici</Link> <br />
									Première visite ? <Link to='#register'>Inscrivez-vous</Link>
								</p>
							</>
						)}
					</div>
				</div>
			</div>
		</section>
	);
}
