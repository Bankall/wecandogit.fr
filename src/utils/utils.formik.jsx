import * as Yup from "yup";
import "yup-phone-lite";
import axios from "axios";
import { useState, useEffect, useRef, useCallback } from "react";
import { Formik, Form, Field, ErrorMessage, useFormikContext, FieldArray } from "formik";
import { Interweave } from "interweave";
import { useParams } from "react-router-dom";

const JSONToYupSchemeConverter = data => {
	const scheme = {};

	data.forEach(value => {
		scheme[value.name] = Yup[value.type]();

		if (value.required) {
			scheme[value.name] = scheme[value.name].required("Champ obligatoire");
		}

		if (value.type === "array") {
			scheme[value.name] = scheme[value.name].test({
				name: "At least one field filled",
				message: "Champ obligatoire",
				test: arr => arr.some(value => !!value)
			});
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

const ExtractInitialValues = async (data, params) => {
	const values = {};

	for await (const value of data) {
		if (value.data_url) {
			const response = await axios(value.data_url);
			const defaults = (typeof value.default !== "undefined" ? value.default.toString() : "").split(",");

			if (value.uitype !== "select") {
				value.default = {};
			}

			if (response.data?.length) {
				value.data = response.data?.map(item => {
					if (value.uitype !== "select") {
						value.default[item.id] = defaults.includes(item.id.toString());
					}

					return {
						key: item.label,
						value: item.id
					};
				});
			}

			if (value.uitype === "select") {
				value.data.unshift({
					value: "",
					key: "Selectionner une valeur"
				});
			}
		}

		if (value.query && value.query.toString().match(/^params:[a-z]+/)) {
			const key = value.query.split(":")[1];
			value.default = params[key];
		}

		values[value.name] = (() => {
			switch (value.uitype) {
				case "radio":
				case "select":
					return typeof value.default !== "undefined" ? value.default : Object.keys(value.data[0]).value;
				case "checkbox":
					return !!value.default;
				case "field-array-datetime-local":
					return [""];
				case "date":
					return typeof value.default !== "undefined" ? new Date(value.default).toISOString().slice(0, -14) : "";
				case "datetime-local":
					return typeof value.default !== "undefined" ? new Date(value.default).toISOString().slice(0, -8) : "";
				default:
					return typeof value.default !== "undefined" ? value.default : "";
			}
		})();
	}

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

		if (typeof value.required === "undefined" && value.uitype !== "checkbox" && value.uitype !== "field-array-checkbox") {
			value.required = true;
		}

		if (value.required && !value.label.match(/\*/)) {
			value.label += "*";
		}

		return value;
	});
};

const FormikBootstrapper = async (data, params) => {
	if (!data) {
		return;
	}

	data = HardcodeSpecialRules(data);

	const bootstrapped = {};

	bootstrapped.validationSchema = JSONToYupSchemeConverter(data);
	bootstrapped.initialValues = await ExtractInitialValues(data, params);
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
	const [customIsSubmitting, setCustomIsSubmitting] = useState(false);
	const [formOptions, setFormOptions] = useState(false);

	const params = useParams();

	useEffect(() => {
		if (options.data) {
			const bootStrap = async () => {
				const { validationSchema, initialValues, data } = await FormikBootstrapper(options.data, params);
				setFormOptions({ validationSchema, initialValues, data });
			};

			bootStrap();
		}
	}, [options.data]);

	return (
		<>
			{formOptions ? (
				<Formik
					initialValues={formOptions.initialValues}
					validationSchema={formOptions.validationSchema}
					onSubmit={async (values, action) => {
						setCustomIsSubmitting(true);
						onSubmit({ values, setSubmitting: action.setSubmitting, setCustomIsSubmitting, setSubmitionError, setSubmitionFeedback });
					}}>
					{({ isSubmitting, errors, touched, values }) => (
						<Form>
							{formOptions.data.map(value => {
								let isInvalid = errors[value.name] && touched[value.name];
								let isValid = !errors[value.name] && touched[value.name] && values[value.name];

								switch (value.uitype) {
									case "email":
									case "password":
									case "text":
									case "number":
									case "tel":
									case "address":
									case "date":
									case "datetime-local":
									case "field-array-datetime-local":
										return (
											<div className={`form-row${isValid ? " valid" : isInvalid ? " invalid" : ""}${value.halfsize ? " halfsize" : ""}`} key={`form-row-${value.name}`}>
												{!options.use_placeholders ? (
													<div className='label-wrapper'>
														<label htmlFor={value.name}> {value.label} </label>
													</div>
												) : null}

												{value.tooltip && !options.use_placeholders ? <div className='tooltip'> {value.tooltip} </div> : null}
												<div className={`relative ${["number", "date", "datetime-local", "field-array-datetime-local"].includes(value.uitype) ? "inline-block" : ""}`}>
													<div className='feedback'>
														<ErrorMessage name={value.name} component='div' />
														{isValid ? <div>✓</div> : null}
													</div>

													{value.prefix ? <div className='prefix'>{value.prefix}</div> : null}
													{value.suffix ? <div className='suffix'>{value.suffix}</div> : null}

													{value.uitype === "field-array-datetime-local" ? (
														<FieldArray
															name={value.name}
															render={arrayHelpers => (
																<div className='flex-row flex-row-reverse'>
																	{values[value.name].map((key, index) => (
																		<div key={`${value.name}.${index}`}>
																			<Field
																				name={`${value.name}.${index}`}
																				onBlur={event => {
																					if (event.target.value) {
																						return arrayHelpers.push("");
																					}

																					if (values.date.length > 1) {
																						arrayHelpers.remove(index);
																					}
																				}}
																				type='datetime-local'
																				min={new Date().toISOString().slice(0, -8)}
																			/>
																		</div>
																	))}
																</div>
															)}
														/>
													) : (
														<Field type={value.uitype} name={value.name} autoComplete={value.disableAutocomplete ? "one-time-code" : value.name} maxLength={value.maxLength} placeholder={options.use_placeholders ? value.label : value.placeholder} />
													)}
												</div>
											</div>
										);
									case "textarea":
										return (
											<div className={`form-row${isValid ? " valid" : isInvalid ? " invalid" : ""}${value.halfsize ? " halfsize" : ""}`} key={`form-row-${value.name}`}>
												<div className=''>
													{!options.use_placeholders ? (
														<div className='label-wrapper'>
															<label htmlFor={value.name}> {value.label} </label>
														</div>
													) : null}

													<Field component={value.uitype} name={value.name} autoComplete={value.name} maxLength={value.maxLength} placeholder={options.use_placeholders ? value.label : value.placeholder} />

													{value.tooltip && !options.use_placeholders ? <div className='tooltip'> {value.tooltip} </div> : null}
												</div>
											</div>
										);
									case "radio":
										return (
											<div className={`form-row radio-wrapper`} key={`form-row-${value.name}`}>
												<div className='label-wrapper'>
													<label> {value.label} </label>
												</div>
												<div className='relative inline-block'>
													{value.data.map(option => {
														let key = Object.keys(option)[0];

														return (
															<label key={key} className='radio-col'>
																<Field type='radio' name={value.name} value={key} />
																<span>{option[key]}</span>
															</label>
														);
													})}
												</div>
											</div>
										);
									case "select":
										return (
											<div className={`form-row${isValid ? " valid" : isInvalid ? " invalid" : ""}${value.halfsize ? " halfsize" : ""}`} key={`form-row-${value.name}`}>
												{!options.use_placeholders ? (
													<div className='label-wrapper'>
														<label htmlFor={value.name}> {value.label} </label>
													</div>
												) : null}

												{value.tooltip && !options.use_placeholders ? <div className='tooltip'> {value.tooltip} </div> : null}

												<div className={`relative ${value.uitype === "number" ? "inline-block" : ""}`}>
													<div className='feedback'>
														<ErrorMessage name={value.name} component='div' />
														{isValid ? <div>✓</div> : null}
													</div>

													{value.prefix ? <div className='prefix'>{value.prefix}</div> : null}
													{value.suffix ? <div className='suffix'>{value.suffix}</div> : null}

													<Field as='select' name={value.name}>
														{value.data.map(item => {
															return (
																<option value={item.value} key={item.value}>
																	{item.key}
																</option>
															);
														})}
													</Field>
												</div>
											</div>
										);
									case "checkbox":
										return (
											<div className='form-row checkbox-wrapper' key={`form-row-${value.name}`}>
												<div className='checkbox-col'>
													<label className='flex-row'>
														<Field type={value.uitype} name={value.name} />
														<Interweave content={value.label} />
													</label>
												</div>
											</div>
										);
									case "field-array-checkbox":
										return (
											<div className='form-row checkbox-wrapper' key={`form-row-${value.name}`}>
												<label className='flex-row'>
													<Interweave content={value.label} />
												</label>
												<div className='checkbox-col flex-row'>
													<FieldArray
														name={value.name}
														render={() => {
															return value.data.map(item => {
																return (
																	<label className='flex-row' key={item.value}>
																		<Field type='checkbox' name={`${value.name}.${item.value}`} />

																		<Interweave content={item.key} />
																	</label>
																);
															});
														}}
													/>
												</div>
											</div>
										);
									default:
										return <div className='form-row' key={`form-row-${value.name}`}></div>;
								}
							})}

							{formOptions.data.some(question => question.required) ? <span className='legal-notice'>*Champs obligatoires</span> : null}
							{options.form_legal_notice ? <Interweave className='legal-notice' content={options.form_legal_notice} /> : null}

							<div className='form-row button-wrapper'>
								<button type='submit' disabled={isSubmitting} className={customIsSubmitting ? "loading" : "toto"}>
									{submitText || "Valider"}
								</button>
							</div>

							<div className='error-feedback'>
								<p>{submitionError}</p>
							</div>
							<div className='submition-feedback'>
								<p>{submitionFeedback}</p>
							</div>

							<FormikFormObserver data={formOptions.data} />
						</Form>
					)}
				</Formik>
			) : null}
		</>
	);
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export { FormikBootstrapper, FormikWrapper, sleep };
