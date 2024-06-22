import axios from "axios";

import { FormikWrapper } from "../utils/utils.formik";
import { useNavigate } from "react-router-dom";
import { Package } from "../data/dashboard-form-data";
export function PackageCreate() {
	const navigate = useNavigate();

	return (
		<section>
			<div className='content'>
				<h2>Enregistrer une nouvelle formule</h2>
				<div className='box big-box'>
					<FormikWrapper
						options={{
							data: Package,
							use_placeholders: false
						}}
						submitText='Enregistrer'
						onSubmit={async ({ values, setSubmitionError, setSubmitionFeedback }) => {
							setSubmitionError("");
							setSubmitionFeedback("");

							try {
								const fixedValues = {
									activity: []
								};

								Object.keys(values).forEach(key => {
									if (key.match(/activity-[0-9]+/) && values[key]) {
										if (key === "activity") return;
										const [name, id] = key.split("-");
										return fixedValues.activity.push(id);
									}

									fixedValues[key] = values[key];
								});

								fixedValues.activity = fixedValues.activity.join(",");

								const response = await axios.post("/package", fixedValues, { withCredentials: true });

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

export { PackageCreate as Component };
