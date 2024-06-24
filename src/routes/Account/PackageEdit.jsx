import { Package } from "../../data/dashboard-form-data";
import { Component } from "../../components/DashboardEditComponent";

export function EditRoute() {
	return <Component type='package' rawformData={Package} />;
}

export { EditRoute as Component };
