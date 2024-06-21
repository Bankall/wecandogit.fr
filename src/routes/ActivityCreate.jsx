import axios from "axios";

import { FormikWrapper } from "../utils/utils.formik";
import { useNavigate } from "react-router-dom";
import { Activity } from "../data/dashboard-form-data";
export default function ActivitiyCreate() {
	const navigate = useNavigate();

	return (
		<section>
			<div className='content'>
				<h2>Enregistrer une nouvelle activité</h2>
				<div className='box big-box'>
					<FormikWrapper
						options={{
							data: Activity
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
