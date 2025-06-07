import axios from "axios";
import { useEffect, useState } from "react";
import { FormikWrapper } from "../utils/utils.formik";
import { UserProfile } from "../data/dashboard-form-data";

import DashboardListComponent from "./DashboardListComponent";
import Loading from "./Loading";
import { useParams, useNavigate, useLocation } from "react-router-dom";

export default function AccountInfo() {
	const [formData, setFormData] = useState(false);
	const { id } = useParams();
	const navigate = useNavigate();
	const { hash } = useLocation();

	useEffect(() => {
		const fetch = async () => {
			try {
				const response = await axios.get(id ? `/user/${id}` : "/me");

				if (response.data.ok) {
					setFormData(
						UserProfile.filter(row => {
							if (row.acl && row.acl.is_trainer && !response.data.result.is_trainer) {
								return false;
							}

							return true;
						}).map(row => {
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
			<div className='box '>
				<DashboardListComponent title='Mes Animaux' addLabel='Ajouter un animal' type='dog' />
			</div>
			<div className='margin-t-50'>
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
								const response = await axios.put(`update-user${id ? `/${id}` : ""}`, values);

								if (response.data.error) throw response.data.error;
								if (response.data.ok) {
									if (id || hash === "#missing-address") {
										navigate(-1);
									}

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
			</div>
		</>
	);
}
