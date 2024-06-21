import axios from "axios";
import { useEffect, useState } from "react";
import { FormikWrapper } from "../utils/utils.formik";
import Loading from "./Loading";

export default function AccountInfo() {
	const [formData, setFormData] = useState(false);
	const rawFormData = [
		{
			name: "email",
			type: "string",
			label: "Adresse email",
			uitype: "email"
		},
		{
			name: "password",
			type: "string",
			label: "Mot de passe (laissez vide pour ne pas le changer)",
			uitype: "password",
			disableAutocomplete: true,
			required: false
		},
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
		},
		{
			name: "instagram",
			type: "string",
			prefix: "@",
			label: "Compte instagram",
			uitype: "text"
		}
	];

	useEffect(() => {
		const fetch = async () => {
			try {
				const response = await axios.get("/me", { withCredentials: true });

				if (response.data.ok) {
					setFormData(
						rawFormData.map(row => {
							const item = Object.assign({}, row);

							if (typeof response.data.result[item.name] !== "undefined") {
								item.default = response.data.result[item.name] === null ? "" : response.data.result[item.name];
							}

							return item;
						})
					);
				}
			} catch (e) {}
		};

		fetch();
	}, []);

	return (
		<>
			{formData ? (
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
							const response = await axios.put("update-user", values, { withCredentials: true });

							if (response.data.error) throw response.data.error;
							if (response.data.ok) {
								setSubmitionFeedback("Mis à jour");
								setTimeout(() => {
									setSubmitionFeedback("");
								}, 3000);
							}
						} catch (err) {
							const errMessage = err.message || err;
							setSubmitionError(errMessage);
						}
					}}
				/>
			) : (
				<Loading />
			)}
		</>
	);
}
