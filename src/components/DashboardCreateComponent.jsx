import axios from "axios";

import { FormikWrapper } from "../utils/utils.formik";
import { useNavigate } from "react-router-dom";
import { useCookies } from "react-cookie";
export function DashboardCreateComponent({ title, type, rawformData }) {
	const navigate = useNavigate();
	const [cookies, setCookies] = useCookies();

	return (
		<section>
			<div className='content'>
				<h2>{title}</h2>
				<div className='box big-box'>
					<FormikWrapper
						options={{
							data: rawformData.filter(row => (row.acl && row.acl.is_trainer ? !!cookies.is_trainer : true)),
							use_placeholders: false
						}}
						submitText='Enregistrer'
						onSubmit={async ({ values, setSubmitionError, setSubmitionFeedback }) => {
							setSubmitionError("");
							setSubmitionFeedback("");

							try {
								const fixedValues = Object.assign({}, values);
								rawformData.forEach(row => {
									if (row.uitype === "field-array-checkbox") {
										fixedValues[row.name] = Object.keys(values[row.name]);
									}
								});

								const response = await axios.post(`/${type}`, fixedValues, { withCredentials: true });

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

export { DashboardCreateComponent as Component };
