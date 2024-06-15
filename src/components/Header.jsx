import { NavLink, Link } from "react-router-dom";
import { useFetch } from "../hooks/useFetch";

import "./Header.css";
import { useState } from "react";

export default function Header() {
	const cartItems = useFetch("/get-cart-item");
	const isLoggedIn = useFetch("/is-logged-in");
	const [menuToogle, setMenuToggle] = useState(false);

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
						<NavLink to='/qui-sommes-nous'>Qui sommes nous ?</NavLink>
					</li>
					<li>
						<NavLink to='/agenda'>Notre agenda</NavLink>
					</li>
					<li>
						<NavLink to='/activites'>Nos activitée</NavLink>
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
				<div className={isLoggedIn.loading ? "hidden" : isLoggedIn.data?.ok ? "" : "disabled"}>
					<Link to='/account' title='Acceder à mon compte'>
						<i className='fa-regular fa-user'></i>
					</Link>
				</div>
				<div className='disabled'>
					<Link to='/cart' className={cartItems.data?.count ? "has-items" : ""}>
						<i className='fa-solid fa-cart-shopping'></i>
						{cartItems.data?.count ? <span className='cart-item-count'>{cartItems.data.count}</span> : null}
					</Link>
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
