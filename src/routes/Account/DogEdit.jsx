import { Dog } from "../../data/dashboard-form-data";
import { Component } from "../../components/DashboardEditComponent";

function EditRoute() {
	return <Component type='dog' rawformData={Dog} />;
}

export { EditRoute as Component };
