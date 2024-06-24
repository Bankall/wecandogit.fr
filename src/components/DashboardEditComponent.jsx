import axios from "axios";
import { useEffect, useState } from "react";
import { FormikWrapper, sleep } from "../utils/utils.formik";
import { useNavigate, useParams } from "react-router-dom";

export default function DashboardEditComponent({ type, rawformData }) {
	const navigate = useNavigate();
	const params = useParams();

	const [dataError, setDataError] = useState(false);
	const [label, setLabel] = useState(false);
	const [formData, setFormData] = useState(false);

	const onSubmit = async ({ values, setCustomIsSubmitting, setSubmitionError, setSubmitionFeedback }) => {
		setSubmitionError("");
		setSubmitionFeedback("");

		try {
			const response = await axios.put(`/${type}/${params.id}`, values, { withCredentials: true });

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
	};

	useEffect(() => {
		const fetch = async () => {
			try {
				const response = await axios.get(`/${type}/${params.id}`, { withCredentials: true });

				if (Object.keys(response.data).length) {
					setFormData(
						rawformData.map(row => {
							const item = Object.assign({}, row);

							if (typeof response.data[item.name] !== "undefined") {
								item.default = response.data[item.name] === null ? "" : response.data[item.name];

								if (item.name === "label") {
									setLabel(response.data[item.name]);
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
						<h2>Mettre à jour {label}</h2>
						<div className='box big-box'>
							<FormikWrapper
								options={{
									data: formData,
									use_placeholders: false
								}}
								submitText='Enregistrer'
								onSubmit={onSubmit}
							/>
						</div>
					</>
				)}
			</div>
		</section>
	);
}

export { DashboardEditComponent as Component };
