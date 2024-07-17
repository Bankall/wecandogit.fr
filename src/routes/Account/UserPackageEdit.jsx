import { UserPackage } from "../../data/dashboard-form-data";
import { Component } from "../../components/DashboardEditComponent";

function EditRoute() {
	return <Component type='user_package' rawformData={UserPackage} />;
}

export { EditRoute as Component };
