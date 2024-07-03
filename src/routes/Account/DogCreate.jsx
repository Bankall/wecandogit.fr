import { Dog } from "../../data/dashboard-form-data";
import { Component } from "../../components/DashboardCreateComponent";

function CreateRoute() {
	return <Component type='dog' rawformData={Dog} title='Ajouter un animal' />;
}

export { CreateRoute as Component };
