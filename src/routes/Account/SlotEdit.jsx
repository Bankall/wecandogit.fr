import { Slot } from "../../data/dashboard-form-data";
import { Component } from "../../components/DashboardEditComponent";

function EditRoute() {
	return <Component type='slot' rawformData={Slot} />;
}

export { EditRoute as Component };
