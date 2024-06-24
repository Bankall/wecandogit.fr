import { Activity } from "../../data/dashboard-form-data";
import { Component } from "../../components/DashboardCreateComponent";

export function CreateRoute() {
	return <Component type='activity' rawformData={Activity} />;
}

export { CreateRoute as Component };
