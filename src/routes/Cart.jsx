import axios from "axios";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const updateCartItem = async (setError, action, item, value) => {
	try {
		setError("");

		const params = {
			url: `/cart/${item.type}/${item.id}/${item.id_dog}`
		};

		if (action === "delete") {
			params.method = "DELETE";
		} else {
			params.method = "PUT";
			params.data = {};

			if (action === "update-payment") {
				params.data.payment_type = value;
			}

			if (action === "update-dog") {
				params.data.id_dog = value;
			}
		}

		const response = await axios(params);

		if (response.data.error) {
			throw response.data.error;
		}

		if (response.data.ok) {
			window.dispatchEvent(new Event("cart-modified"));
		}
	} catch (err) {
		setError(`Une erreur s'est produite ${err}`);
		console.log("Une erreur s'est produite", err);
	}
};

const ListItem = ({ item, setError }) => {
	return (
		<div className='row flex-col flex-stretch'>
			<span className='flex-row'>
				<span className='flex-grow'>{item.label}</span>
				<span className='flex-row'>
					<span className='price'>{item.price}€</span>
					<span
						onClick={() => {
							updateCartItem(setError, "delete", item);
						}}>
						<i className='fa-solid fa-trash-can' style={{ color: "var(--invalid-color)", cursor: "pointer" }}></i>
					</span>
				</span>
			</span>
			<span className='flex-row margin-10'>
				<span className='flex-grow'>
					{item.dogs && item.dogs.length > 1 && (
						<select
							name='dog-selector'
							value={item.id_dog || items.dogs[0].id}
							onChange={event => {
								updateCartItem(setError, "update-dog", item, event.currentTarget.value);
							}}>
							{item.dogs.map((dog, index) => (
								<option key={index} value={dog.id}>
									{dog.label}
								</option>
							))}
						</select>
					)}
				</span>
				<span className='flex-grow'>
					<select
						name='payment-options'
						value={item.payment_type || "direct"}
						onChange={event => {
							updateCartItem(setError, "update-payment", item, event.currentTarget.value);
						}}>
						<option value='direct'>Payer en ligne</option>
						<option value='later'>Payer en personne</option>
						{item.type === "slot" &&
							item.package_available?.length &&
							item.package_available.map((_package, index) => (
								<option value={_package.id} key={index}>
									Utiliser la formule {_package.label}
								</option>
							))}
					</select>
				</span>
			</span>
		</div>
	);
};

const fetchCartItems = async setCartItems => {
	try {
		const carItems = await axios.get("/cart/full-cart");
		setCartItems(carItems);
	} catch (err) {
		console.error(err);
	}
};
function Cart() {
	const [cartItems, setCartItems] = useState({});
	const BACKEND_BASE_URL = import.meta.env.VITE_API_ENDPOINT;

	const [error, setError] = useState("");

	useEffect(() => {
		const fetch = () => {
			fetchCartItems(setCartItems);
		};

		fetch();
		window.addEventListener("cart-modified", fetch);
		return () => window.removeEventListener("cart-modified", fetch);
	}, []);

	return (
		<>
			<section className='cart' id='a-propos'>
				<div className='content'>
					<h2>Panier</h2>
					<div className='widgets flex-col center'>
						{cartItems.data?.notice?.is_logged_in === false ? (
							<div className='box notice' style={{ maxWidth: "800px" }}>
								Veuillez vous connecter pour valider votre panier
								<div className='margin-t-20 center'>
									<Link to='/login/cart'>
										<button>Se connecter</button>
									</Link>
								</div>
							</div>
						) : cartItems.data?.notice?.has_dog === false ? (
							<div className='box notice' style={{ maxWidth: "800px" }}>
								Vous devez premièrement créer le profil de votre animal
								<div className='margin-t-20 center'>
									<Link to='/account/profile'>
										<button>Créer son profil</button>
									</Link>
								</div>
							</div>
						) : null}
						{cartItems.data?.result?.length ? (
							cartItems.data?.result?.map(trainer => (
								<div className={`box ${Object.values(cartItems.data.notice).length ? "disabled" : ""}`} style={{ maxWidth: "800px" }} key={trainer.id}>
									<div className='title'>{trainer.firstname}</div>

									{trainer.package.map((item, index) => (
										<ListItem item={item} key={index} setError={setError} />
									))}

									{trainer.slot.map((item, index) => (
										<ListItem item={item} key={index} setError={setError} />
									))}

									<div className='flex-row row space-between margin-t-20'>
										<span className='uppercase'>Total a payer maintenant: </span>
										<span>{trainer.total}€</span>
									</div>

									<div className='margin-t-20 right'>
										{trainer.total > 0 ? (
											<a className='' href={`${BACKEND_BASE_URL}/cart/checkout/${trainer.id}`}>
												<button>Payer</button>
											</a>
										) : (
											<a className='' href={`${BACKEND_BASE_URL}/cart/make-reservation/${trainer.id}`}>
												<button>Réserver</button>
											</a>
										)}
									</div>

									<div className='error-feedback margin-tb-20'>{error}</div>
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
