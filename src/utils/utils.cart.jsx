import axios from "axios";

const addToCart = async ({ type, id, element }) => {
	try {
		if (element) {
			element.classList.add("loading");
		}

		await axios.post(`/cart/add/`, { type, id });
		window.dispatchEvent(new Event("cart-modified"));

		if (element) {
			setTimeout(() => {
				element?.classList?.remove("loading");
			}, 1000);
		}

		return true;
	} catch (err) {
		return false;
	}
};

const instantBooking = async ({ type, id }) => {
	try {
	} catch (err) {
		return err.message || "Une erreur s'est produite";
	}
};

export { addToCart, instantBooking };
