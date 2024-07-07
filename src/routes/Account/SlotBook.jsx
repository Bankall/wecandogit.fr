import { SlotBookForm } from "../../data/dashboard-form-data";
import { Component } from "../../components/DashboardCreateComponent";

function SlotBook() {
	return <Component type='reservation' rawformData={SlotBookForm} title='Inscrire un chien' />;
}

export { SlotBook as Component };
