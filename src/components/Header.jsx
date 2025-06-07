import { NavLink, Link, useLocation } from "react-router-dom";
import { useFetch } from "../hooks/useFetch";

import axios from "axios";
import "./Header.css";

import { useState, useEffect } from "react";
import { Interweave } from "interweave";

export default function Header() {
	const isLoggedIn = useFetch("/is-logged-in");
	const [menuToogle, setMenuToggle] = useState(false);
	const [cartCount, setCartCount] = useState(0);
	const [debugTrigger, setDebugTrigger] = useState(0);
	const [debugMode, setDebugMode] = useState(false);
	const [debugInfo, setDebugInfo] = useState("");
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
		document.body.classList.toggle("menu-opened", menuToogle);
	}, [menuToogle]);

	useEffect(() => {
		setMenuToggle(false);
	}, [location]);

	useEffect(() => {
		const timeout = setTimeout(() => {
			console.log("reset debug trigger", debugTrigger);
			setDebugTrigger(0);
		}, 2000);

		return () => {
			clearTimeout(timeout);
		};
	}, [debugTrigger]);

	useEffect(() => {
		if (debugMode) {
			console.log("Enabling debug mode");

			window.console.log = window.console.error = function () {
				const message = [];

				Array.from(arguments).forEach(arg => {
					let part = arg;

					if (typeof arg === "object") {
						part = JSON.stringify(arg, null, 2);
					}

					message.push(part);
				});

				setDebugInfo(debugInfo + message.join(" ") + "<br/>");
			};
		}
	}, [debugMode]);

	return (
		<>
			<header>
				<NavLink to='/'>
					<div
						className='logo'
						onClick={() => {
							setDebugTrigger(debugTrigger + 1);
							if (debugTrigger > 6) {
								setDebugMode(true);
							}
						}}>
						<img src='/logo.png' />
					</div>
				</NavLink>
				<span className='flex-row'>
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
								<button>
									<img src='/assets/medias/pawprint.png' alt='pawprint' style={{ width: 20 }} />
									<span>Se connecter</span>
								</button>
							</Link>
						</div>
						<div className={`burger-menu${menuToogle ? " active" : ""}`} onClick={() => setMenuToggle(!menuToogle)}>
							<span>Menu</span>
						</div>
					</div>
				</span>
			</header>
			<div
				style={{
					fontSize: debugInfo ? "12px" : "0"
				}}>
				<Interweave content={debugInfo} />
			</div>
		</>
	);
}
