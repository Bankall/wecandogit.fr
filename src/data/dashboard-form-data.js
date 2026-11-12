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
		label: "Description de l'activité (version courte)",
		uitype: "textarea"
	},
	{
		name: "long_description",
		type: "string",
		label: "Description de l'activité (version longue pour le listing de toutes les activités)",
		uitype: "textarea"
	},
	{
		name: "header",
		type: "string",
		label: "Nom de l'activité (pour la page de listing des activités)",
		uitype: "text",
		required: false
	},
	{
		name: "product_page_short_description",
		type: "string",
		label: "Description courte de l'activité (pour la page de listing des activités)",
		uitype: "rich-text",
		required: false
	},
	{
		name: "product_page_description",
		type: "string",
		label: "Description de l'activité (version longue pour la page dédiée à l'activité)",
		uitype: "rich-text",
		required: false
	},
	{
		name: "card_footer",
		type: "string",
		label: "Texte de bas de carte d'activité (pour la page dédiée à l'activité)",
		uitype: "rich-text",
		required: false
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
		uitype: "number",
		min: 1
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

// Pre-fills the slot creation form: the only place the default location comes from
// (the slot.location column has no default, older slots have no location)
const DEFAULT_SLOT_LOCATION = "We Can Dog It, Les Sables, 51370 Les Mesneux";
const SLOT_LOCATION_TOOLTIP = "Laisser vide si le lieu n'est pas encore connu";
const SLOT_PUBLIC_TOOLTIP = "Décoché, le créneau n'apparaît pas dans l'agenda : il reste dans votre espace, où vous pouvez y inscrire des chiens";

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
	},
	{
		name: "location",
		label: "Lieu",
		type: "string",
		uitype: "address-autocomplete",
		maxLength: 255,
		default: DEFAULT_SLOT_LOCATION,
		tooltip: SLOT_LOCATION_TOOLTIP,
		required: false
	},
	{
		name: "is_public",
		label: "Visible dans l'agenda",
		type: "string",
		uitype: "checkbox",
		default: true,
		tooltip: SLOT_PUBLIC_TOOLTIP
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
	},
	{
		name: "location",
		label: "Lieu",
		type: "string",
		uitype: "address-autocomplete",
		maxLength: 255,
		tooltip: SLOT_LOCATION_TOOLTIP,
		required: false
	},
	{
		name: "is_public",
		label: "Visible dans l'agenda",
		type: "string",
		uitype: "checkbox",
		tooltip: SLOT_PUBLIC_TOOLTIP
	}
];

const SlotBookForm = [
	{
		name: "id_slot",
		label: "ID du créneau",
		type: "number",
		uitype: "hidden",
		query: "params:id"
	},
	{
		name: "id_dog",
		label: "Choisir un chien dans la liste",
		type: "string",
		uitype: "select",
		data_url: "/all-dogs",
		required: false
	},
	{
		name: "dog_label",
		label: "Ou écrire son nom du chien si son profil n'existe pas encore",
		type: "string",
		uitype: "text",
		required: false
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
		name: "description",
		type: "string",
		label: "Description",
		uitype: "textarea"
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
		name: "validity_period",
		type: "number",
		label: "Durée de validité (en mois)",
		default: 12,
		uitype: "number"
	},
	{
		name: "activity",
		type: "object",
		label: "Activités inclues",
		uitype: "field-array-checkbox",
		data_url: "/activity"
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

const UserPackage = [
	{
		name: "id_package",
		type: "string",
		label: "Formule",
		uitype: "select",
		data_url: "/package"
	},
	{
		name: "usage",
		type: "number",
		label: "Séances déjà utilisées",
		uitype: "number"
	},
	{
		name: "start",
		label: "Date de début",
		type: "string",
		uitype: "datetime-local"
	}
];

const UserPackageAdd = [
	{
		name: "id_user",
		label: "USER ID",
		type: "number",
		uitype: "hidden",
		query: "params:id_user"
	},
	{
		name: "id_package",
		type: "string",
		label: "Formule",
		uitype: "select",
		data_url: "/package"
	},
	{
		name: "usage",
		type: "number",
		label: "Séances déjà utilisées",
		uitype: "number"
	},
	{
		name: "start",
		label: "Date de début",
		type: "string",
		uitype: "datetime-local"
	}
];

const Address = [
	{
		name: "address",
		type: "string",
		label: "Adresse",
		uitype: "text"
	},
	{
		name: "postal_code",
		type: "string",
		label: "Code postal",
		uitype: "text",
		inputmode: "numeric"
	},
	{
		name: "city",
		type: "string",
		label: "Ville",
		uitype: "text"
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
	...Address,
	{
		name: "instagram",
		type: "string",
		prefix: "@",
		required: false,
		label: "Compte instagram",
		uitype: "text"
	},
	{
		name: "stripe_sk",
		type: "string",
		required: false,
		label: "Clé secrète Stripe",
		uitype: "password",
		disableAutocomplete: "off",
		acl: {
			is_trainer: true
		}
	},
	{
		name: "vat_applicable",
		type: "string",
		label: "Facturer la TVA sur mes prestations",
		uitype: "checkbox",
		acl: {
			is_trainer: true
		}
	},
	{
		name: "newsletter_optin",
		type: "string",
		label: "Recevoir le planning de la semaine/le mois par email",
		uitype: "checkbox"
	},
	{
		name: "reminder_optin",
		type: "string",
		label: "Recevoir les rappels de réservation par email",
		uitype: "checkbox"
	},
	{
		name: "can_pay_later",
		type: "string",
		label: "Autoriser le paiement en personne (sinon : en ligne ou avec une formule déjà réglée)",
		uitype: "checkbox",
		acl: {
			// A permission a trainer sets on a member, not a field of one's own profile
			other_user: true
		}
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
	...Address,
	{
		name: "instagram",
		type: "string",
		prefix: "@",
		required: false,
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
		label: "Race de l'animal",
		uitype: "text"
	},
	{
		name: "sexe",
		type: "string",
		label: "Sexe",
		uitype: "radio",
		data: [{ F: "Femelle" }, { M: "Mâle" }]
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
		required: false,
		acl: {
			is_trainer: true
		}
	}
];

export { Dog, UserProfile, LoginForm, RegisterForm, Activity, Package, Slot, SlotCreateForm, SlotBookForm, UserPackage, UserPackageAdd };
