import { Link, useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { Interweave } from "interweave";

import axios from "axios";

const LogError = async error => {
	await axios.post("/log-error", {
		error: error.error ? error.error.toString() : error.toString()
	});
};

const formatDate = date => {
	date = new Date(date.replace(/-/g, "/"));
	return date.toLocaleString().slice(0, 16);
};

const isNotTooLate = date => {
	if (!date) {
		return false;
	}

	date = new Date(date.replace(/-/g, "/"));
	return date.getTime() - Date.now() > 86400 * 1000;
};

const markAsPaid = async (id, typeOverride, type) => {
	try {
		await axios.put(`/${typeOverride || type}/${id}`, { paid: 1 });
		window.dispatchEvent(new Event(`refresh-list-${type || typeOverride}`));
	} catch (err) {
		await LogError(err);
	}
};
const handleDelete = async (id, typeOverride, type) => {
	try {
		if (typeOverride === "slot" && !window.confirm("Es tu sur de vouloir supprimer ce créneau ?")) {
			return;
		}

		if (typeOverride === "reservation" && !window.confirm("Es tu sur de vouloir supprimer cette réservation ?")) {
			return;
		}

		await axios.put(`/${typeOverride || type}/${id}`, { enabled: 0 });
		window.dispatchEvent(new Event(`refresh-list-${type || typeOverride}`));
	} catch (err) {
		await LogError(err);
	}
};

const shouldBeFiltered = (filter, item) => {
	if (filter.match(/^id\:/)) {
		const filterId = parseInt(filter.split(":")[1], 10);

		if (item.id !== filterId) {
			return true;
		}

		return false;
	}

	const normalize = string => {
		return string
			.normalize("NFD")
			.replace(/[\u0300-\u036f]/g, "")
			.toLowerCase();
	};

	const words = filter.split(/\s/).map(word => normalize(word));
	const fullString = normalize(`${item.date ? formatDate(item.date) : ""} ${item.group_label || ""} ${item.label} ${(item.dogs || []).map(dog => dog.label).join(" ")}`);

	let everyWordsMatch = true;

	words.forEach(word => {
		if (!fullString.includes(word)) {
			everyWordsMatch = false;
		}
	});

	if (!everyWordsMatch) {
		return true;
	}
};

/*
 * Filter values are kept in localStorage, keyed by the current URL, so they
 * survive a remount (navigating away then back) without leaking to other pages.
 * They expire after a while so an old filter never silently hides rows.
 */
const FILTER_STORAGE_PREFIX = "dashboard-filter:";
const FILTER_STORAGE_TTL = 5 * 60 * 1000;

// Pages that always start with an empty filter.
const FILTER_STORAGE_EXCLUDED_PATHS = ["/account/notifications"];

const getFilterStorageKey = pathname => {
	pathname = pathname.replace(/\/+$/, "");

	if (FILTER_STORAGE_EXCLUDED_PATHS.includes(pathname)) {
		return false;
	}

	return pathname;
};

const readStoredFilter = key => {
	if (!key) {
		return false;
	}

	try {
		const stored = JSON.parse(window.localStorage.getItem(FILTER_STORAGE_PREFIX + key));

		if (!stored || !stored.value || stored.expires < Date.now()) {
			window.localStorage.removeItem(FILTER_STORAGE_PREFIX + key);
			return false;
		}

		return stored.value;
	} catch (err) {
		return false;
	}
};

const writeStoredFilter = (key, value) => {
	if (!key) {
		return;
	}

	try {
		if (!value) {
			window.localStorage.removeItem(FILTER_STORAGE_PREFIX + key);
			return;
		}

		window.localStorage.setItem(FILTER_STORAGE_PREFIX + key, JSON.stringify({ value, expires: Date.now() + FILTER_STORAGE_TTL }));
	} catch (err) {
		// localStorage unavailable (private mode, quota exceeded) : the filter simply won't persist
	}
};

const getPaymentLabel = item => {
	if (item.paid) {
		let label = "Réglé";

		if (item.payment_type === "package") {
			label += " avec une formule";
		} else if (item.payment_type === "direct") {
			label += " via Stripe";
		}

		return label;
	}

	if ((item.how || item.payment_type) === "direct") {
		return "En attente de paiement";
	}

	return "Non réglé";
};

/*
 * Lien de paiement signé, à copier puis envoyer au client (SMS, mail...) : il
 * fonctionne même si le client n'est pas connecté.
 */
const CopyPaymentLinkButton = ({ url }) => {
	const [copied, setCopied] = useState(false);

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(url);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch (err) {
			// Presse-papier indisponible (http, permission refusée) : on affiche le lien
			window.prompt("Lien de paiement à copier", url);
		}
	};

	return (
		<button className='smallest' onClick={copy} title={url}>
			{copied ? "Lien copié !" : "Copier le lien de paiement"}
		</button>
	);
};

export default function DashboardListComponent({ type, title, addLabel, allowedActions, id_user, endpoint }) {
	const [response, setResponse] = useState(false);
	const [filter, setFilter] = useState(false);
	const [extraTitle, setExtraTitle] = useState(false);

	const params = useParams();
	const pathname = window.location.pathname;
	const storageKey = getFilterStorageKey(pathname);

	const setFilterWrapper = value => {
		setFilter(value);
		writeStoredFilter(storageKey, value);
	};

	useEffect(() => {
		let exited = false;
		const fetch = async () => {
			try {
				const params = {};

				if (id_user) {
					params.id_user = id_user;
				}

				const response = await axios({
					url: `/${endpoint || type}`,
					method: "GET",
					params
				});

				if (!exited) {
					setResponse(response);
				}
			} catch (err) {
				console.error(err);
			}
		};

		setFilter(readStoredFilter(storageKey));
		setExtraTitle(false);

		fetch();
		window.addEventListener(`refresh-list-${type}`, fetch);

		if (params.action === "filter") {
			setFilter(`id:${params.id}`);
		}

		(async () => {
			try {
				if (id_user) {
					const user = await axios.get(`/user/${id_user}`);
					setExtraTitle(`${user.data.firstname} ${user.data.lastname}`);
				}
			} catch (err) {
				console.log(err);
			}
		})();

		return () => {
			exited = true;
			window.removeEventListener(`refresh-list-${type}`, fetch);
		};
	}, [params]);

	if (!allowedActions) {
		allowedActions = ["modify"];
	}

	return (
		<>
			<div className='title'>
				{title}
				{extraTitle ? " - " + extraTitle : ""}
			</div>
			<div className='content'>
				{response.data?.length && (response.data?.length > 10 || params.action === "filter" || filter) ?
					<div className='filter-box margin-b-20'>
						<input
							type='text'
							name='filter'
							defaultValue={filter ? filter : ""}
							onKeyUp={event => {
								setFilterWrapper(event.target.value);
							}}
							placeholder='Filtrer les résultats'
							key={pathname}
						/>
						<span
							className='clear-filter'
							onClick={() => {
								document.querySelector("input[name=filter]").value = "";
								setFilterWrapper(false);
							}}>
							x
						</span>
					</div>
				:	null}

				{addLabel && (
					<Link className='margin-b-20' to={`/account/${type}/create${id_user ? `/${id_user}` : ""}`}>
						<button>{addLabel}</button>
					</Link>
				)}

				{response.data?.length ?
					response.data.map((item, index) => {
						if (filter && shouldBeFiltered(filter, item)) {
							return <div key={index}></div>;
						}

						return (
							<div className='row' key={index} id={item.id}>
								<div className='flex-row no-wrap'>
									<span className='list-detail'>
										{item.date ? `${formatDate(item.date)} - ` : ""}
										{item.group_label ?
											<>
												{item.date ?
													<>
														<b>{item.group_label}</b> - <Interweave content={item.label} />
													</>
												:	<>
														{item.group_label} - <Interweave content={item.label} />
													</>
												}
											</>
										:	<Interweave className='flex-grow' content={item.label} />}
									</span>

									{item.email && item.id && (
										<span>
											<a href={`${axios.defaults.baseURL}/fake-user/${item.id}`} target='_blank'>
												<button className='small'>Fake me</button>
											</a>
										</span>
									)}

									{allowedActions.includes("pay") && item.pay_url && !item.paid && (
										<a href={item.pay_url}>
											<button className='smallest'>Payer en ligne</button>
										</a>
									)}

									{allowedActions.includes("pay-reservation") && typeof item.paid !== "undefined" && !item.paid && (
										<a href={`${import.meta.env.VITE_API_ENDPOINT}/cart/pay-reservation/${item.id}`}>
											<button className='smallest'>Payer en ligne</button>
										</a>
									)}

									{allowedActions.includes("copy-payment-link") && item.pay_url && !item.paid && <CopyPaymentLinkButton url={item.pay_url} />}

									{typeof item.paid !== "undefined" && <span className={item.paid ? "paid" : "unpaid"}>{getPaymentLabel(item)}</span>}

									{allowedActions.includes("book-reservation") && (
										<Link to={`/account/${type}/book/${item.id}`}>
											<button className='small'>Inscire un chien</button>
										</Link>
									)}

									{allowedActions.includes("modify") && (
										<Link to={`/account/${type}/edit/${item.id}`}>
											<button className='small'>Modifier</button>
										</Link>
									)}

									{allowedActions.includes("handleUserPackage") && (
										<Link to={`/account/users/user-package/${item.id}`}>
											<button className='small'>Voir les formules</button>
										</Link>
									)}

									{allowedActions.includes("handleUserReservation") && (
										<Link to={`/account/users/reservations/${item.id}`}>
											<button className='small'>Voir les réservations</button>
										</Link>
									)}

									{allowedActions.includes("marked-package-as-paid") && (
										<button
											className='small'
											onClick={() => {
												markAsPaid(item.id, "user_package", type);
											}}>
											Marquer comme réglé
										</button>
									)}

									{(allowedActions.includes("delete") || (allowedActions.includes("delete-24") && isNotTooLate(item.date))) && (
										<i
											className='fa-solid fa-trash-can'
											aria-hidden='true'
											style={{ color: "var(--invalid-color)", cursor: "pointer" }}
											onClick={() => {
												handleDelete(item.id, type);
											}}></i>
									)}
								</div>

								{item.dogs && item.dogs.length ?
									<div>
										<ul className='margin-t-10'>
											{item.dogs.map((dog, index) => (
												<li className='flex-row' key={index}>
													{dog.id && (
														<>
															{dog.id_reservation && (
																<i
																	className='fa-solid fa-trash-can'
																	aria-hidden='true'
																	style={{ color: "var(--invalid-color)", cursor: "pointer" }}
																	onClick={() => {
																		handleDelete(dog.id_reservation, "reservation", "slot");
																	}}></i>
															)}

															<Link to={`/account/dog/edit/${dog.id}`}>
																<i className='fa-solid fa-pen' aria-hidden='true' style={{ cursor: "pointer" }}></i>
															</Link>
														</>
													)}
													<span className='flex-grow'>&nbsp;- {dog.label}</span>
													{typeof dog.paid !== "undefined" && <span className={dog.paid ? "paid" : "unpaid"}>{getPaymentLabel(dog)}</span>}
													{allowedActions.includes("copy-payment-link") && dog.pay_url && !dog.paid && <CopyPaymentLinkButton url={dog.pay_url} />}
													{typeof dog.paid !== "undefined" && !dog.paid && (
														<button
															className='smallest'
															onClick={async () => {
																const { data } = await axios.put(`/reservation/${dog.id_reservation}`, { paid: 1, payment_type: "later" });
																const { id } = data;

																if (id) {
																	dispatchEvent(new Event(`refresh-list-${type}`));
																}
															}}>
															Marquer comme réglé
														</button>
													)}
												</li>
											))}
										</ul>
									</div>
								:	null}

								{item.details && item.details.length ?
									<div>
										<span>Détail</span>
										<ul className='margin-t-10'>
											{item.details.map((detail, index) => (
												<li className='flex-row' key={index}>
													<span className='flex-grow'>&nbsp;- {detail.label}</span>
													<span className='price'>
														<b>{detail.price}€</b>
													</span>
												</li>
											))}
										</ul>
									</div>
								:	null}

								{item.waiting_list && item.waiting_list.length ?
									<div>
										<span>List d'attente</span>
										<ul className='margin-t-10'>
											{item.waiting_list.map((detail, index) => (
												<li className='flex-row' key={index}>
													<span className='flex-grow'>&nbsp;- {detail.label}</span>
													<span className='price'>
														<b>{detail.status}</b>
													</span>
												</li>
											))}
										</ul>
									</div>
								:	null}
							</div>
						);
					})
				:	"Aucun élément pour l'instant"}
			</div>
		</>
	);
}
