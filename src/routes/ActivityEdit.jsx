import axios from "axios";
import { useEffect, useState } from "react";
import { FormikWrapper } from "../utils/utils.formik";
import Loading from "../components/Loading";
import { useNavigate, useParams } from "react-router-dom";

export default function ActivitiyEdit() {
	const navigate = useNavigate();
	const params = useParams();

	const [dataError, setDataError] = useState(false);
	const [activityLabel, setActivityLabel] = useState(false);
	const [formData, setFormData] = useState(false);
	const rawFormData = [
		{
			name: "id",
			type: "number",
			uitype: "hidden"
		},
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

	useEffect(() => {
		const fetch = async () => {
			try {
				const response = await axios.get(`/activity/${params.id}`, { withCredentials: true });

				if (Object.keys(response.data).length) {
					setFormData(
						rawFormData.map(row => {
							const item = Object.assign({}, row);

							if (typeof response.data[item.name] !== "undefined") {
								item.default = response.data[item.name] === null ? "" : response.data[item.name];

								if (item.name === "label") {
									setActivityLabel(response.data[item.name]);
								}
							}

							return item;
						})
					);
				} else {
					setDataError(true);
				}
			} catch (e) {}
		};

		fetch();
	}, []);

	return (
		<section>
			<div className='content'>
				{dataError ? (
					<h2>Vous n'avez pas accès à cette ressource</h2>
				) : (
					<>
						<h2>Mettre à jour {activityLabel}</h2>
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
										const response = await axios.put(`/activity/${values.id}`, values, { withCredentials: true });

										if (response.data.error) throw response.data.error;
										if (response.data.id) {
											setTimeout(() => {
												navigate("/account/#activities");
											}, 2000);
										}
									} catch (err) {
										const errMessage = err.message || err;
										setSubmitionError(errMessage);
									}
								}}
							/>
						</div>
					</>
				)}
			</div>
		</section>
	);
}

export { ActivitiyEdit as Component };
