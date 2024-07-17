import { SlotCreateForm } from "../../data/dashboard-form-data";
import { Component } from "../../components/DashboardCreateComponent";

function CreateRoute() {
	return <Component type='slot' rawformData={SlotCreateForm} title='Ajouter un créneau' endpoint='create-slots' />;
}

export { CreateRoute as Component };
