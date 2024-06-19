import * as Yup from "yup";
import "yup-phone-lite";

import { useState, useEffect, useRef, useCallback } from "react";
import { Formik, Form, Field, ErrorMessage, useFormikContext } from "formik";
import { Interweave } from "interweave";

const JSONToYupSchemeConverter = data => {
	const scheme = {};

	data.forEach(value => {
		scheme[value.name] = Yup[value.type]();

		if (value.required) {
			scheme[value.name] = scheme[value.name].required("Champ obligatoire");
		}

		if (value.maxLength && value.type !== "number") {
			scheme[value.name] = scheme[value.name].max(value.maxLength, "");
		}

		if (value.minLength && value.type !== "number") {
			scheme[value.name] = scheme[value.name].min(value.minLength, `Dois faire au moins ${value.minLength} caractères`);
		}

		if (typeof value.minValue !== "undefined") {
			scheme[value.name] = scheme[value.name].min(value.minValue);
		}

		if (typeof value.maxValue !== "undefined") {
			scheme[value.name] = scheme[value.name].max(value.maxValue);
		}

		switch (value.name) {
			case "email":
				scheme[value.name] = scheme[value.name].email("Addresse email non valide");
				break;
			case "phone":
				scheme[value.name] = scheme[value.name]
					.matches(/[0-9\s+]+/)
					.matches(/^\+33 (6|7)/, "Numéro de portable uniquement")
					.phone("FR", "Numéro de téléphone invalide");
				break;
			default:
				break;
		}
	});

	return Yup.object(scheme);
};

const ExtractInitialValues = data => {
	const values = {};

	data.forEach(value => {
		values[value.name] = (() => {
			switch (value.uitype) {
				case "radio":
				case "select":
					return Object.keys(value.options[0])[0];
				case "checkbox":
					return value.default;
				default:
					return typeof value.default !== "undefined" ? value.default : "";
			}
		})();
	});

	return values;
};

const HardcodeSpecialRules = data => {
	return data.map(value => {
		switch (value.uitype) {
			case "tel":
				value.maxLength = 17;
				break;
			case "password":
				value.minLength = 8;
				break;
			default:
				break;
		}

		if (typeof value.required === "undefined") {
			value.required = true;
		}

		if (value.required) {
			value.label += "*";
		}

		return value;
	});
};

const FormikBootstrapper = data => {
	if (!data) {
		return;
	}

	data = HardcodeSpecialRules(data);

	const bootstrapped = {};

	bootstrapped.validationSchema = JSONToYupSchemeConverter(data);
	bootstrapped.initialValues = ExtractInitialValues(data);
	bootstrapped.data = data;

	return bootstrapped;
};

const FormikFormObserver = ({ data }) => {
	const { values, setFieldValue, setFieldTouched } = useFormikContext();
	const lastValues = useRef("");
	const onFieldChange = useCallback(() => {
		Object.keys(values).forEach(key => {
			const value = values[key];

			if (typeof value === "undefined") {
				return; // No value, nothing to do
			}

			if (key === "phone") {
				const newPhoneValue = value
					.replace(/^0/, "+33") // Replace initial 0 with international French code
					.replace(/[^0-9+]/g, "") // Trim anything but numbers and "+"
					.replace(/^\+33(\d)(\d)/, "+33 $1 $2") // Custom spacing for first digits
					.replace(/(([0-9]{2})(\s|))/g, "$2 ") // Spacing for the rest of the number
					.replace(/\s$/g, "") // Trim trailing whitespace
					.substr(0, 17); // Prevent too long strings

				if (value !== newPhoneValue) {
					setFieldValue("phone", newPhoneValue, false);
				}
			}

			if (typeof value === "string" && value.length > 4) {
				// Emulate touched prop when there is a value to trigger validation
				setFieldTouched(key);
			}

			const fieldData = (data || []).find(field => field.name === key);

			if (!fieldData) {
				return;
			}
			if (typeof value === "number") {
				const length = value.toString().length;
				const max = fieldData.maxLength || fieldData.exactLength;
				const min = fieldData.minValue || fieldData.exactLength;

				if (max && length > max) {
					setFieldValue(key, parseFloat(value.toString().slice(0, max), 10), false);
				}

				if (min) {
					// can't find a proper way to do this, let's forget it for now
					// if(length < min) {
					// 	errors[key] = `${min} caractères minimum`;
					// } else {
					// 	delete errors[key];
					// }
				}
			}
		});
	}, [data, values, setFieldValue, setFieldTouched]);

	useEffect(() => {
		const stringifiedValues = JSON.stringify(values);
		if (lastValues.current !== stringifiedValues) {
			onFieldChange();
		}

		lastValues.current = stringifiedValues;
	}, [values, onFieldChange]);
};

const FormikWrapper = ({ options, onSubmit, submitText }) => {
	const [submitionError, setSubmitionError] = useState("");
	const [submitionFeedback, setSubmitionFeedback] = useState("");

	if (!options.validationSchema) {
		const { validationSchema, initialValues, data } = FormikBootstrapper(options.data);
		options.validationSchema = validationSchema;
		options.initialValues = initialValues;
		options.data = data;
	}

	return (
		<Formik
			initialValues={options.initialValues}
			validationSchema={options.validationSchema}
			onSubmit={async (values, action) => {
				onSubmit({ values, setSubmitting: action.setSubmitting, setSubmitionError, setSubmitionFeedback });
			}}>
			{({ isSubmitting, errors, touched, values }) => (
				<Form>
					{options.data.map(value => {
						let isInvalid = errors[value.name] && touched[value.name];
						let isValid = !errors[value.name] && touched[value.name] && values[value.name];

						switch (value.uitype) {
							case "email":
							case "password":
							case "text":
							case "number":
							case "tel":
							case "address":
								return (
									<div className={`form-row${isValid ? " valid" : isInvalid ? " invalid" : ""}${value.halfsize ? " halfsize" : ""}`} key={`form-row-${value.name}`}>
										{!options.use_placeholders ? (
											<div className='flex items-center space-between'>
												<label htmlFor={value.name}> {value.label} </label>
											</div>
										) : null}

										<div className='feedback'>
											<ErrorMessage name={value.name} component='div' />
											{isValid ? <div>✓</div> : null}
										</div>

										{value.tooltip && !options.use_placeholders ? <div className='tooltip'> {value.tooltip} </div> : null}

										<Field type={value.uitype} name={value.name} autoComplete={value.name} maxLength={value.maxLength} placeholder={options.use_placeholders ? value.label : ""} />
									</div>
								);
							case "radio":
								return (
									<div className={`form-row`} key={`form-row-${value.name}`}>
										<div className='flex items-center space-between'>
											<label> {value.label} </label>
										</div>
										<div className='flex items-center radio-wrapper'>
											{value.options.map(option => {
												let key = Object.keys(option)[0];

												return (
													<label key={key}>
														<Field type='radio' name={value.name} value={key} />
														<span>{option[key]}</span>
													</label>
												);
											})}
										</div>
									</div>
								);
							case "checkbox":
								return (
									<div className={`form-row`} key={`form-row-${value.name}`}>
										<div className='flex items-center checkbox-wrapper'>
											<label>
												<Field type={value.uitype} name={value.name} autoComplete={value.name} maxLength={value.maxLength} placeholder={options.use_placeholders ? value.label : ""} />
												<Interweave content={value.label} />
											</label>
										</div>
									</div>
								);
							default:
								return <div className='form-row' key={`form-row-${value.name}`}></div>;
						}
					})}

					{options.data.some(question => question.required) ? <span className='legal-notice'>*Champs obligatoires</span> : null}
					{options.form_legal_notice ? <Interweave className='legal-notice' content={options.form_legal_notice} /> : null}

					<div className='form-row button-wrapper'>
						<button type='submit' disabled={isSubmitting}>
							{submitText || "Valider"}
						</button>
					</div>

					<div className='error-feedback'>
						<p>{submitionError}</p>
					</div>
					<div className='submition-feedback'>
						<p>{submitionFeedback}</p>
					</div>

					<FormikFormObserver data={options.data} />
				</Form>
			)}
		</Formik>
	);
};

export { FormikBootstrapper, FormikWrapper };
