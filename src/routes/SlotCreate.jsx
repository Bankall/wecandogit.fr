import axios from "axios";

import { FormikWrapper } from "../utils/utils.formik";
import { useNavigate } from "react-router-dom";
import { SlotCreateForm } from "../data/dashboard-form-data";
export function SlotCreate() {
	const navigate = useNavigate();

	return (
		<section>
			<div className='content'>
				<h2>Enregistrer un nouveau créneau</h2>
				<div className='box big-box'>
					<FormikWrapper
						options={{
							data: SlotCreateForm,
							use_placeholders: false
						}}
						submitText='Enregistrer'
						onSubmit={async ({ values, setSubmitionError, setSubmitionFeedback }) => {
							setSubmitionError("");
							setSubmitionFeedback("");

							try {
								const response = await axios.post("/create-slots", values, { withCredentials: true });

								if (response.data.error) throw response.data.error;
								if (response.data.ok) {
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

export { SlotCreate as Component };
