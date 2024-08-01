import { FormikWrapper } from "../utils/utils.formik";
import axios from "axios";

function ResetPassword() {
	const form = [
		{
			name: "email",
			type: "string",
			label: "Adresse email",
			uitype: "email"
		}
	];

	return (
		<section className='flex-row'>
			<div className='box big-box'>
				<div className='title'>Renseignez votre adresse email</div>

				<div className='content'>
					<FormikWrapper
						options={{
							data: form,
							use_placeholders: true,
							form_legal_notice: "Une fois votre email renseigné vous allez recevoir par mail un lien pour mettre à jour votre mot de passe"
						}}
						submitText='Recevoir le lien'
						onSubmit={async ({ values, setSubmitionFeedback, setSubmitionError }) => {
							setSubmitionFeedback("");
							setSubmitionError("");

							try {
								const response = await axios.get(`/password/send-reset-mail/${encodeURIComponent(values.email)}`);
								if (!response.data.ok) {
									throw "error";
								}

								setSubmitionFeedback("Le mail a été envoyé, veuillez vérifier votre boite mail, vous pouvez fermer cette page.");
							} catch (err) {
								setSubmitionError("Une erreur s'est produite, veuillez nous contacter à contact.wecandogit@gmail.com");
							}
						}}
					/>
				</div>
			</div>
		</section>
	);
}

export { ResetPassword as Component };
