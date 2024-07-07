import { SlotBook } from "../../data/dashboard-form-data";
import { Component } from "../../components/DashboardCreateComponent";

function SlotBook() {
	return <Component type='slot' rawformData={SlotBook} title='Inscrire un chien' />;
}

export { SlotBook as Component };
