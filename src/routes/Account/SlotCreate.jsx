import { Slot } from "../../data/dashboard-form-data";
import { Component } from "../../components/DashboardCreateComponent";

export function CreateRoute() {
	return <Component type='slot' rawformData={Slot} />;
}

export { CreateRoute as Component };
