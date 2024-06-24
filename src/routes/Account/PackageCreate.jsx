import { Package } from "../../data/dashboard-form-data";
import { Component } from "../../components/DashboardCreateComponent";

export function CreateRoute() {
	return <Component type='package' rawformData={Package} />;
}

export { CreateRoute as Component };
