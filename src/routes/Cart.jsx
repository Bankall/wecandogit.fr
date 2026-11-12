import axios from "axios";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

// The server keeps two carts: the regular one, and the one a waiting-list offer
// fills (source "waiting-list"). Every cart call names the one it works on.
const withSource = (url, source) => (source ? `${url}?source=${encodeURIComponent(source)}` : url);

const updateCartItem = async (setError, action, item, value, source) => {
	try {
		setError("");

		const params = {
			url: withSource(`/cart/${item.id_cart_item}/${item.type}/${item.id}/${item.id_dog}`, source)
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

const ListItem = ({ item, setError, unavailableSlots, canPayLater, source }) => {
	const isAvailable = unavailableSlots?.find(slot => slot.id === item.id) ? false : true;

	return (
		<div className='row flex-col flex-stretch'>
			<span className={`flex-row ${!isAvailable ? "error-feedback" : ""}`}>
				<span className='flex-grow'>{item.label}</span>
				<span className='flex-row'>
					<span className='price'>{item.price}€</span>
					<span
						onClick={() => {
							updateCartItem(setError, "delete", item, undefined, source);
						}}>
						<i className='fa-solid fa-trash-can' style={{ color: "var(--invalid-color)", cursor: "pointer" }}></i>
					</span>
				</span>
			</span>
			<span className={`flex-row margin-10 ${item.type !== "slot" ? "height-0 hidden" : ""}`}>
				<span className='flex-grow'>
					{item.dogs && item.dogs.length > 1 && (
						<select
							name='dog-selector'
							value={item.id_dog || item.dogs[0].id}
							onChange={event => {
								updateCartItem(setError, "update-dog", item, event.currentTarget.value, source);
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
							updateCartItem(setError, "update-payment", item, event.currentTarget.value, source);
						}}>
						<option value='direct'>Payer en ligne</option>
						{item.type === "slot" && canPayLater && <option value='later'>Payer en personne</option>}
						{item.type === "slot" &&
							item.package_available?.length > 0 &&
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

const fetchCartItems = async (setCartItems, source) => {
	try {
		const carItems = await axios.get(withSource("/cart/full-cart", source));
		setCartItems(carItems);
	} catch (err) {
		console.error(err);
	}
};

const CartByTrainer = ({ trainer, disabled, canPayLater, source }) => {
	const BACKEND_BASE_URL = import.meta.env.VITE_API_ENDPOINT;
	const [error, setError] = useState("");
	const [unavailableSlots, setUnavailableSlots] = useState([]);

	const checkAvailability = async url => {
		try {
			const { data } = await axios.get("/get-all-slots");
			const unavailableSlots = [];

			trainer.slot.forEach(slot => {
				const slotAvailable = data.result.find(availableSlot => {
					if (availableSlot.id_slot === slot.id) {
						return availableSlot.spots > (availableSlot.reservations || []).length;
					}
				});

				if (!slotAvailable) {
					unavailableSlots.push(slot);
				}
			});

			if (!unavailableSlots.length) {
				return (window.location.href = url);
			}

			setError(`Les créneaux suivants ne sont plus disponibles: ${unavailableSlots.map(slot => slot.label).join(", ")}`);
			setUnavailableSlots(unavailableSlots);
		} catch (err) {
			console.error(err);
		}
	};

	return (
		<div className={`box ${disabled ? "disabled" : ""}`} style={{ maxWidth: "800px" }} key={trainer.id}>
			<div className='title'>{trainer.firstname}</div>

			{trainer.package.map((item, index) => (
				<ListItem item={item} key={index} setError={setError} canPayLater={canPayLater} source={source} />
			))}

			{trainer.slot.map((item, index) => (
				<ListItem item={item} key={index} setError={setError} unavailableSlots={unavailableSlots} canPayLater={canPayLater} source={source} />
			))}

			{trainer.tax_excluded > 0 && (
				<>
					<div className='flex-row row space-between margin-t-20'>
						<span className='uppercase'>TOTAL NET HT: </span>
						<span>{trainer.tax_excluded}€</span>
					</div>
				</>
			)}

			{trainer.vat > 0 && (
				<>
					<div className='flex-row row space-between margin-t-20'>
						<span className='uppercase'>TVA (20%): </span>
						<span>{trainer.vat}€</span>
					</div>
				</>
			)}

			<div className='flex-row row space-between margin-t-20'>
				<span className='uppercase'>Total a payer maintenant: </span>
				<span>{trainer.total}€</span>
			</div>

			<div className='margin-t-20'>
				{trainer.total > 0 ? (
					<>
						<span style={{ fontSize: "0.8em" }}>La reservation sera validée au moment où vous cliquez sur le bouton ci-dessous</span>

						<a
							onClick={() => {
								checkAvailability(withSource(`${BACKEND_BASE_URL}/cart/checkout/${trainer.id}`, source));
							}}>
							<button className='margin-t-10'>Confirmer mes réservations</button>
						</a>
					</>
				) : (
					<a
						className=''
						onClick={() => {
							checkAvailability(withSource(`${BACKEND_BASE_URL}/cart/make-reservation/${trainer.id}`, source));
						}}>
						<button>Réserver</button>
					</a>
				)}
			</div>

			<div className='error-feedback margin-tb-20'>{error}</div>
		</div>
	);
};

/*
 * Notices + the cart's content, split by trainer. `source` picks the server-side
 * cart (none: the regular cart); `loginPath` is where to come back after logging in.
 */
const CartContent = ({ source, loginPath = "/login/cart", emptyLabel = "Votre panier est vide" }) => {
	const [cartItems, setCartItems] = useState({});
	useEffect(() => {
		const fetch = () => {
			fetchCartItems(setCartItems, source);
		};

		fetch();

		window.addEventListener("cart-modified", fetch);
		return () => window.removeEventListener("cart-modified", fetch);
	}, [source]);

	return (
		<div className='widgets flex-col center'>
			{cartItems.data?.notice?.is_logged_in === false ? (
				<div className='box notice' style={{ maxWidth: "800px" }}>
					Veuillez vous connecter pour valider votre panier
					<div className='margin-t-20 center'>
						<Link to={loginPath}>
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
			) : cartItems.data?.notice?.has_address === false ? (
				<div className='box notice' style={{ maxWidth: "800px" }}>
					Vous devez renseigner votre adresse pour valider la facture
					<div className='margin-t-20 center'>
						<Link to='/account/profile#missing-address'>
							<button>Renseigner son adresse</button>
						</Link>
					</div>
				</div>
			) : null}
			{cartItems.data?.result?.length ? cartItems.data?.result?.map(trainer => <CartByTrainer key={trainer.id} trainer={trainer} disabled={Object.values(cartItems.data.notice).length} canPayLater={cartItems.data.can_pay_later !== false} source={source} />) : <div className='box'>{emptyLabel}</div>}
		</div>
	);
};

function Cart() {
	return (
		<>
			<section className='cart' id='a-propos'>
				<div className='content'>
					<h2>Panier</h2>
					<CartContent />
				</div>
			</section>
		</>
	);
}

export { Cart as Component, CartContent };
