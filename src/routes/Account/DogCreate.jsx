import { Dog } from "../../data/dashboard-form-data";
import { Component } from "../../components/DashboardCreateComponent";

export function CreateRoute() {
	return <Component type='dog' rawformData={Dog} />;
}

export { CreateRoute as Component };
