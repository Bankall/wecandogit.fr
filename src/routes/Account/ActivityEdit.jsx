import { Activity } from "../../data/dashboard-form-data";
import { Component } from "../../components/DashboardEditComponent";

export function EditRoute() {
	return <Component type='activity' rawformData={Activity} />;
}

export { EditRoute as Component };
