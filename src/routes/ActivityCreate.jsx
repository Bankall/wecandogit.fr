import axios from "axios";

import { FormikWrapper } from "../utils/utils.formik";
import { useNavigate } from "react-router-dom";

export default function ActivitiyCreate() {
	const navigate = useNavigate();
	const formData = [
		{
			name: "label",
			type: "string",
			label: "Nom de l'activité",
			uitype: "text"
		},
		{
			name: "group_label",
			type: "string",
			label: "Groupe d'activité",
			notice: "Toutes les activités avec le même nom de groupe seront regroupés ensemble",
			uitype: "text"
		},
		{
			name: "description",
			type: "string",
			label: "Description de l'activité",
			uitype: "textarea"
		},
		{
			name: "is_collective",
			type: "string",
			label: "Activité collective",
			required: false,
			uitype: "checkbox"
		},
		{
			name: "spots",
			type: "number",
			label: "Nombre de place",
			uitype: "number"
		},
		{
			name: "price",
			type: "number",
			label: "Prix TTC",
			suffix: "€",
			uitype: "number"
		},
		{
			name: "vat",
			type: "number",
			label: "TVA 20% par défaut",
			suffix: "%",
			required: false,
			uitype: "number"
		}
	];

	return (
		<section>
			<div className='content'>
				<h2>Enregistrer une nouvelle activité</h2>
				<div className='box big-box'>
					<FormikWrapper
						options={{
							data: formData,
							use_placeholders: true
						}}
						submitText='Enregistrer'
						onSubmit={async ({ values, setSubmitionError, setSubmitionFeedback }) => {
							setSubmitionError("");
							setSubmitionFeedback("");

							try {
								const response = await axios.post("/activity", values, { withCredentials: true });

								if (response.data.error) throw response.data.error;
								if (response.data.id) {
									setTimeout(() => {
										navigate(-1);
									}, 2000);
								}
							} catch (err) {
								const errMessage = err.message || err;
								setSubmitionError(errMessage);
							}
						}}
					/>
				</div>
			</div>
		</section>
	);
}

export { ActivitiyCreate as Component };
