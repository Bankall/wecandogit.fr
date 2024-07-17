import { UserPackageAdd } from "../../data/dashboard-form-data";
import { Component } from "../../components/DashboardCreateComponent";

function CreateRoute() {
	return <Component type='user_package' rawformData={UserPackageAdd} title='Attribuer une formule' />;
}

export { CreateRoute as Component };
