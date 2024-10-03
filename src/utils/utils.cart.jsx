import axios from "axios";

const addToCart = async ({ type, id, element }) => {
	try {
		const response = await axios.post(`/cart/add/`, { type, id });
		window.dispatchEvent(new Event("cart-modified"));

		return response.data;
	} catch (err) {
		return {
			cantAddMore: true
		};
	}
};

const instantBooking = async ({ type, id }) => {
	try {
	} catch (err) {
		return err.message || "Une erreur s'est produite";
	}
};

const addToWaitingList = async ({ id_slot }) => {
	try {
		const response = await axios.post(`/waiting-list/add/${id_slot}`);
		window.dispatchEvent(new Event("cart-modified"));

		return response.data;
	} catch (err) {
		return {
			cantAddMore: true
		};
	}
};

export { addToCart, instantBooking, addToWaitingList };
