import { useNavigate } from "react-router-dom";
import { FormikWrapper } from "../utils/utils.formik";
import axios from "axios";
export default function GenerateNewPassword() {
	const navigate = useNavigate();

	const form = [
		{
			name: "password",
			type: "string",
			label: "Mot de passe",
			uitype: "password"
		}
	];

	return (
		<section className='box big-box'>
			<div className='title'>Nouveau mot de passe</div>
			<div className='content'>
				<FormikWrapper
					options={{
						data: form,
						use_placeholders: true
					}}
					onSubmit={async ({ values, setSubmitionFeedback, setSubmitionError }) => {
						setSubmitionFeedback("");
						setSubmitionError("");

						const searchParams = new URLSearchParams(window.location.search);

						values.email = searchParams.get("email");
						values.token = searchParams.get("token");

						try {
							const response = await axios.post(`/reset-password`, values);
							if (!response.data.ok) {
								throw "error";
							}

							setSubmitionFeedback("Le mot de passe a été mis à jour ! Vous allez être redirigé vers la page de connexion");

							setTimeout(() => {
								navigate("/login");
							}, 4000);
						} catch (err) {
							console.log(err);
							setSubmitionError("Une erreur s'est produite, veuillez nous contacter à contact.wecandogit@gmail.com");
						}
					}}
				/>
			</div>
		</section>
	);
}

export { GenerateNewPassword as Component };
