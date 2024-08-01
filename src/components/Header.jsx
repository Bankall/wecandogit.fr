import { NavLink, Link, useLocation } from "react-router-dom";
import { useFetch } from "../hooks/useFetch";

import axios from "axios";
import "./Header.css";

import { useState, useEffect } from "react";

export default function Header() {
	const isLoggedIn = useFetch("/is-logged-in");
	const [menuToogle, setMenuToggle] = useState(false);
	const [cartCount, setCartCount] = useState(0);
	const location = useLocation();

	useEffect(() => {
		const fetch = () => {
			axios
				.get("/cart/count")
				.then(res => setCartCount(res.data.count))
				.catch(err => console.error(err));
		};

		window.addEventListener("cart-modified", fetch);
		fetch();

		return () => window.removeEventListener("cart-modified", fetch);
	}, []);

	useEffect(() => {
		setMenuToggle(false);
	}, [location]);

	return (
		<header>
			<NavLink to='/'>
				<div className='logo'>
					<img src='/logo.png' />
				</div>
			</NavLink>

			<nav className={menuToogle ? "active" : null} onClick={() => setMenuToggle(false)}>
				<ul>
					<li>
						<NavLink to='/a-propos'>Qui sommes nous ?</NavLink>
					</li>
					<li>
						<NavLink to='/agenda'>Notre agenda</NavLink>
					</li>
					<li>
						<NavLink to='/activites'>Nos activités</NavLink>
					</li>
					<li>
						<NavLink to='/formules-et-tarifs'>Formules et tarifs</NavLink>
					</li>
				</ul>
			</nav>

			<div className='tools'>
				<div className='disabled'>
					<Link to='/search' title='Rechercher sur le site'>
						<i className='fa-solid fa-magnifying-glass'></i>
					</Link>
				</div>
				<div className={!cartCount ? "disabled" : ""}>
					<Link to='/cart' className={cartCount ? "has-items" : ""}>
						<i className='fa-solid fa-cart-shopping'></i>
						{cartCount ? <span className='cart-item-count'>{cartCount}</span> : null}
					</Link>
				</div>
				<div className={isLoggedIn.loading ? "hidden" : isLoggedIn.data?.ok ? "" : "disabled"}>
					<Link to='/account' title='Acceder à mon compte'>
						<i className='fa-regular fa-user'></i>
					</Link>
				</div>
				<div className={isLoggedIn.loading ? "hidden" : isLoggedIn.data?.ok ? "" : "disabled"}>
					<a href={`${import.meta.env.VITE_API_ENDPOINT}/auth/logout`} title='Se deconnecter'>
						<i className='fa-solid fa-power-off'></i>
					</a>
				</div>
				<div className={`has-text${isLoggedIn.loading ? " hidden" : isLoggedIn.data?.ok ? " disabled" : ""}`}>
					<Link to='/login'>
						<button>Se connecter</button>
					</Link>
				</div>
				<div className={`burger-menu${menuToogle ? " active" : ""}`} onClick={() => setMenuToggle(!menuToogle)}>
					<span>Menu</span>
				</div>
			</div>
		</header>
	);
}
