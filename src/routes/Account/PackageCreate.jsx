import { Package } from "../../data/dashboard-form-data";
import { Component } from "../../components/DashboardCreateComponent";

function CreateRoute() {
	return <Component type='package' rawformData={Package} title='Ajouter une formule' />;
}

export { CreateRoute as Component };
