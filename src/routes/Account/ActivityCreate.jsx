import { Activity } from "../../data/dashboard-form-data";
import { Component } from "../../components/DashboardCreateComponent";

function CreateRoute() {
	return <Component type='activity' rawformData={Activity} title='Ajouter une activité' />;
}

export { CreateRoute as Component };
