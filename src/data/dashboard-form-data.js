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

const UserProfile = [
	{
		name: "email",
		type: "string",
		label: "Adresse email",
		uitype: "email"
	},
	{
		name: "password",
		type: "string",
		label: "Mot de passe (laisser vide pour ne pas le changer)",
		uitype: "password",
		disableAutocomplete: true,
		required: false
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
		type: "string",
		label: "Activités inclues",
		uitype: "field-array",
		data_url: "/activity"
	}
];

export { Activity, UserProfile, Package };
