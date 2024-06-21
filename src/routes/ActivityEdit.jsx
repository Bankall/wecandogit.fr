import axios from "axios";
import { useEffect, useState } from "react";
import { FormikWrapper, sleep } from "../utils/utils.formik";
import { Activity } from "../data/dashboard-form-data";
import { useNavigate, useParams } from "react-router-dom";

export default function ActivitiyEdit() {
	const navigate = useNavigate();
	const params = useParams();

	const [dataError, setDataError] = useState(false);
	const [activityLabel, setActivityLabel] = useState(false);
	const [formData, setFormData] = useState(false);

	useEffect(() => {
		const fetch = async () => {
			try {
				const response = await axios.get(`/activity/${params.id}`, { withCredentials: true });

				if (Object.keys(response.data).length) {
					setFormData(
						Activity.map(row => {
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
									data: formData
								}}
								submitText='Enregistrer'
								onSubmit={async ({ values, setCustomIsSubmitting, setSubmitionError, setSubmitionFeedback }) => {
									setSubmitionError("");
									setSubmitionFeedback("");

									try {
										const response = await axios.put(`/activity/${params.id}`, values, { withCredentials: true });

										if (response.data.error) throw response.data.error;
										if (response.data.id) {
											await sleep(2000);
											navigate("/account/#activities");
										}
									} catch (err) {
										const errMessage = err.message || err;
										setSubmitionError(errMessage);
										setCustomIsSubmitting(false);
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
