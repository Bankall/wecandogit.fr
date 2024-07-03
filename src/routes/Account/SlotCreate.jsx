import { Slot } from "../../data/dashboard-form-data";
import { Component } from "../../components/DashboardCreateComponent";

function CreateRoute() {
	return <Component type='slot' rawformData={Slot} title='Ajouter un créneau' />;
}

export { CreateRoute as Component };
