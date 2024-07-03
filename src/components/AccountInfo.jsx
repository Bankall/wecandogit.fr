import axios from "axios";
import { useEffect, useState } from "react";
import { FormikWrapper } from "../utils/utils.formik";
import { UserProfile } from "../data/dashboard-form-data";

import DashboardListComponent from "./DashboardListComponent";
import Loading from "./Loading";

export default function AccountInfo() {
	const [formData, setFormData] = useState(false);

	useEffect(() => {
		const fetch = async () => {
			try {
				const response = await axios.get("/me", { withCredentials: true });

				if (response.data.ok) {
					setFormData(
						UserProfile.map(row => {
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
						data: formData
					}}
					submitText='Enregistrer'
					onSubmit={async ({ values, setSubmitionError, setCustomIsSubmitting, setSubmitionFeedback }) => {
						setSubmitionError("");
						setSubmitionFeedback("");

						try {
							const response = await axios.put("update-user", values, { withCredentials: true });

							if (response.data.error) throw response.data.error;
							if (response.data.ok) {
								setSubmitionFeedback("Joli joli, tout ça.");

								setTimeout(() => {
									setSubmitionFeedback("");
									setCustomIsSubmitting(false);
								}, 2000);
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
			<div className='box'>
				<DashboardListComponent title='Mes Animaux' addLabel='Ajouter un animal' type='dog' />
			</div>
		</>
	);
}
