import axios from "axios";
import { useEffect, useState } from "react";
import { FormikWrapper, sleep } from "../utils/utils.formik";
import { Package } from "../data/dashboard-form-data";
import { useNavigate, useParams } from "react-router-dom";

export default function PackageEdit() {
	const navigate = useNavigate();
	const params = useParams();

	const [dataError, setDataError] = useState(false);
	const [packageLabel, setPackageLabel] = useState(false);
	const [formData, setFormData] = useState(false);

	useEffect(() => {
		const fetch = async () => {
			try {
				const response = await axios.get(`/package/${params.id}`, { withCredentials: true });

				if (Object.keys(response.data).length) {
					setFormData(
						Package.map(row => {
							const item = Object.assign({}, row);

							if (typeof response.data[item.name] !== "undefined") {
								item.default = response.data[item.name] === null ? "" : response.data[item.name];

								if (item.name === "label") {
									setPackageLabel(response.data[item.name]);
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
						<h2>Mettre à jour {packageLabel}</h2>
						<div className='box big-box'>
							<FormikWrapper
								options={{
									data: formData,
									use_placeholders: false
								}}
								submitText='Enregistrer'
								onSubmit={async ({ values, setCustomIsSubmitting, setSubmitionError, setSubmitionFeedback }) => {
									setSubmitionError("");
									setSubmitionFeedback("");

									try {
										const fixedValues = {
											activity: []
										};

										Object.keys(values).forEach(key => {
											if (key === "activity") return;
											if (key.match(/activity-[0-9]+/) && values[key]) {
												const [name, id] = key.split("-");
												return fixedValues.activity.push(id);
											}

											fixedValues[key] = values[key];
										});

										fixedValues.activity = fixedValues.activity.join(",");

										const response = await axios.put(`/package/${params.id}`, fixedValues, { withCredentials: true });

										if (response.data.error) throw response.data.error;
										if (response.data.id) {
											await sleep(2000);
											navigate(-1);
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

export { PackageEdit as Component };
