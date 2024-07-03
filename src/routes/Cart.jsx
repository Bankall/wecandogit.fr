import axios from "axios";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const ListItem = ({ item }) => {
	const updateCartItem = async (item, value) => {
		try {
			const response = await axios.put(
				`/cart/${item.type}/${item.id}`,
				{
					paid_later: value === "later"
				},
				{ withCredentials: true }
			);

			if (response.data.ok) {
				window.dispatchEvent(new Event("cart-item-updated"));
			}
		} catch (err) {
			console.log("Une erreur s'est produite", err);
		}
	};

	return (
		<div className='flex-row row space-between'>
			<span>{item.label}</span>
			<span>{item.price}€</span>
			<span>
				<select
					name='payment-options'
					value={item.paid_later ? "later" : "direct"}
					onChange={event => {
						updateCartItem(item, event.currentTarget.value);
					}}>
					<option value='direct'>Payer en ligne</option>
					<option value='later'>Payer en personne</option>
				</select>
			</span>
		</div>
	);
};

const fetchCartItems = async setCartItems => {
	try {
		const carItems = await axios.get("/cart/full-cart", { withCredentials: true });
		setCartItems(carItems);
	} catch (err) {
		console.error(err);
	}
};
function Cart() {
	const [cartItems, setCartItems] = useState({});
	const BACKEND_BASE_URL = import.meta.env.VITE_API_ENDPOINT;

	useEffect(() => {
		const fetch = () => {
			fetchCartItems(setCartItems);
		};

		fetch();
		window.addEventListener("cart-item-updated", fetch);
		return () => window.removeEventListener("cart-item-updated", fetch);
	}, []);

	return (
		<>
			<section className='cart' id='a-propos'>
				<div className='content'>
					<h2>Panier</h2>
					<div className='widgets flex-col center'>
						{cartItems.data?.notice?.is_logged_in === false && (
							<div className='box notice'>
								Veuillez vous connecter pour valider votre panier
								<div className='margin-t-20 center'>
									<Link to='/login/cart'>
										<button>Se connecter</button>
									</Link>
								</div>
							</div>
						)}

						{cartItems.data?.notice?.has_dog_profile === false && (
							<div className='box notice'>
								Vous devez premièrement créer le profil de votre animal
								<div className='margin-t-20 center'>
									<Link to='/account#profile'>
										<button>Créer son profil</button>
									</Link>
								</div>
							</div>
						)}

						{cartItems.data?.result?.length ? (
							cartItems.data?.result?.map(trainer => (
								<div className={`box ${Object.values(cartItems.data.notice).length ? "disabled" : ""}`} style={{ maxWidth: "800px" }} key={trainer.id}>
									<div className='title'>{trainer.firstname}</div>

									{trainer.package.map((item, index) => (
										<ListItem item={item} key={index} />
									))}

									{trainer.slot.map((item, index) => (
										<ListItem item={item} key={index} />
									))}

									<div className='flex-row row space-between margin-t-20'>
										<span>TOTAL</span>
										<span>{trainer.total}€</span>
									</div>

									<div className='margin-t-20 right'>
										{trainer.total > 0 ? (
											<Link className='disabled' to={`${BACKEND_BASE_URL}/cart/checkout/${trainer.id}`}>
												<button>Payer</button>
											</Link>
										) : (
											<Link className='disabled' to={`${BACKEND_BASE_URL}/cart/make-reservation/${trainer.id}`}>
												<button>Réserver</button>
											</Link>
										)}
									</div>
								</div>
							))
						) : (
							<div className='box'>Votre panier est vide</div>
						)}
					</div>
				</div>
			</section>
		</>
	);
}

export { Cart as Component };
