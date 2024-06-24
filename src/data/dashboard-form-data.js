const Activity = [
	{
		name: "label",
		type: "string",
		label: "Nom de l'activité",
		uitype: "text"
	},
	{
		name: "group_label",
		type: "string",
		label: "Groupe d'activité",
		tooltip: "Toutes les activités avec le même nom de groupe seront regroupés ensemble",
		uitype: "text"
	},
	{
		name: "description",
		type: "string",
		label: "Description de l'activité",
		uitype: "textarea"
	},
	{
		name: "is_collective",
		type: "string",
		label: "Activité collective",
		uitype: "checkbox"
	},
	{
		name: "spots",
		type: "number",
		label: "Nombre de place",
		uitype: "number"
	},
	{
		name: "duration",
		type: "number",
		label: "Durée",
		uitype: "number",
		default: 60,
		suffix: "min"
	},
	{
		name: "price",
		type: "number",
		label: "Prix TTC",
		suffix: "€",
		uitype: "number"
	},
	{
		name: "vat",
		type: "number",
		label: "TVA 0% par défaut",
		suffix: "%",
		placeholder: 0,
		required: false,
		uitype: "number"
	},
	{
		name: "is_public",
		type: "string",
		label: "Afficher cette activité dans la liste publique",
		suffix: "%",
		default: true,
		uitype: "checkbox"
	}
];

const SlotCreateForm = [
	{
		name: "id_activity",
		label: "Activité",
		type: "string",
		uitype: "select",
		data_url: "/activity"
	},
	{
		name: "date",
		label: "Date",
		type: "array",
		uitype: "field-array-datetime-local"
	}
];

const Slot = [
	{
		name: "id_activity",
		label: "Activité",
		type: "string",
		uitype: "select",
		data_url: "/activity"
	},
	{
		name: "date",
		label: "Date",
		type: "string",
		uitype: "datetime-local"
	}
];

const Package = [
	{
		name: "label",
		type: "string",
		label: "Nom de la formule",
		uitype: "text"
	},
	{
		name: "number_of_session",
		type: "number",
		label: "Nombre de séances",
		uitype: "number"
	},
	{
		name: "price",
		type: "number",
		label: "Prix TTC",
		suffix: "€",
		uitype: "number"
	},
	{
		name: "activity",
		type: "object",
		label: "Activités inclues",
		uitype: "field-array-checkbox",
		data_url: "/activity"
	}
];

const UserProfile = [
	{
		name: "email",
		type: "string",
		label: "Adresse email",
		uitype: "email"
	},
	{
		name: "firstname",
		type: "string",
		label: "Prénom",
		uitype: "text"
	},
	{
		name: "lastname",
		type: "string",
		label: "Nom",
		uitype: "text"
	},
	{
		name: "phone",
		type: "string",
		label: "Numéro de téléphone",
		uitype: "tel"
	},
	{
		name: "instagram",
		type: "string",
		prefix: "@",
		required: false,
		label: "Compte instagram",
		uitype: "text"
	}
];

const LoginForm = [
	{
		name: "email",
		type: "string",
		label: "Adresse email",
		uitype: "email"
	},
	{
		name: "password",
		type: "string",
		label: "Mot de passe",
		uitype: "password"
	}
];

const RegisterForm = [...LoginForm];
RegisterForm.push(
	{
		name: "firstname",
		type: "string",
		label: "Prénom",
		uitype: "text"
	},
	{
		name: "lastname",
		type: "string",
		label: "Nom",
		uitype: "text"
	},
	{
		name: "phone",
		type: "string",
		label: "Numéro de téléphone",
		uitype: "tel"
	},
	{
		name: "instagram",
		type: "string",
		prefix: "@",
		label: "Compte instagram",
		uitype: "text"
	}
);

const Dog = [
	{
		name: "label",
		type: "string",
		label: "Nom de l'animal",
		uitype: "text"
	},
	{
		name: "breed",
		type: "string",
		label: "Sa race",
		uitype: "text"
	},
	{
		name: "birthdate",
		type: "string",
		label: "Sa date de naissance",
		uitype: "date"
	},
	{
		name: "trainer_description",
		type: "string",
		label: "Commentaire de l'éducateur",
		uitype: "textarea",
		required: false
	}
];

export { Dog, UserProfile, LoginForm, RegisterForm, Activity, Package, Slot, SlotCreateForm };
