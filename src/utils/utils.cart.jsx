import axios from "axios";

const addToCart = async ({ type, id }) => {
	try {
		await axios.post(`/cart/add/`, { type, id }, { withCredentials: true });
		window.dispatchEvent(new Event("cart-item-added"));
		return true;
	} catch (err) {
		console.log(err);
		return false;
	}
};

const instantBooking = async ({ type, id }) => {
	try {
	} catch (err) {
		console.log(err);
		return err.message || "Une erreur s'est produite";
	}
};

export { addToCart, instantBooking };
