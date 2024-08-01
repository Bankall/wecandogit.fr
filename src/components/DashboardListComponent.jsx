import { Link, useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { Interweave } from "interweave";

import axios from "axios";

const formatDate = date => {
	date = new Date(date);
	return date.toLocaleString().slice(0, 16);
};

const isNotTooLate = date => {
	if (!date) {
		return false;
	}

	date = new Date(date);
	return date.getTime() - Date.now() > 86400 * 1000;
};

const markAsPaid = async (id, typeOverride, type) => {
	try {
		await axios.put(`/${typeOverride || type}/${id}`, { paid: 1 });
		window.dispatchEvent(new Event(`refresh-list-${type || typeOverride}`));
	} catch (err) {
		console.log(err);
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
		console.error(err);
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

export default function DashboardListComponent({ type, title, addLabel, allowedActions, id_user }) {
	const [response, setResponse] = useState(false);
	const [filter, setFilter] = useState(false);
	const [extraTitle, setExtraTitle] = useState(false);

	const params = useParams();

	useEffect(() => {
		let exited = false;
		const fetch = async () => {
			try {
				const params = {};
				if (id_user) {
					params.id_user = id_user;
				}

				const response = await axios({
					url: `/${type}`,
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

		fetch();
		window.addEventListener(`refresh-list-${type}`, fetch);

		setFilter(false);

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
				{response.data?.length && (response.data?.length > 10 || params.action === "filter") ? (
					<div className='filter-box margin-b-20'>
						<input
							type='text'
							name='filter'
							defaultValue={filter ? filter : ""}
							onKeyUp={event => {
								setFilter(event.target.value);
							}}
							placeholder='Filtrer les résultats'
							key={type}
						/>
						<span
							className='clear-filter'
							onClick={() => {
								document.querySelector("input[name=filter]").value = "";
								setFilter(false);
							}}>
							x
						</span>
					</div>
				) : null}

				{addLabel && (
					<Link className='margin-b-20' to={`/account/${type}/create${id_user ? `/${id_user}` : ""}`}>
						<button>{addLabel}</button>
					</Link>
				)}

				{response.data?.length
					? response.data.map((item, index) => {
							if (filter && shouldBeFiltered(filter, item)) {
								return <div key={index}></div>;
							}

							return (
								<div className='row' key={index} id={item.id}>
									<div className='flex-row'>
										<span className='list-detail'>
											{item.date ? `${formatDate(item.date)} - ` : ""}
											{item.group_label ? (
												<>
													{item.date ? (
														<>
															<b>{item.group_label}</b> - <Interweave content={item.label} />
														</>
													) : (
														<>
															{item.group_label} - <Interweave content={item.label} />
														</>
													)}
												</>
											) : (
												<Interweave content={item.label} />
											)}
										</span>

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
												Marquer comme payé
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

									{item.dogs && item.dogs.length ? (
										<div>
											<ul className='margin-t-10'>
												{item.dogs.map((dog, index) => (
													<li className='flex-row' key={index}>
														{dog.id && (
															<i
																className='fa-solid fa-trash-can'
																aria-hidden='true'
																style={{ color: "var(--invalid-color)", cursor: "pointer" }}
																onClick={() => {
																	handleDelete(dog.id, "reservation", "slot");
																}}></i>
														)}
														<span className='flex-grow'>&nbsp;- {dog.label}</span>
														{typeof dog.paid !== "undefined" && <span className={dog.paid ? "paid" : "unpaid"}>{dog.paid ? `Réglé${dog.payment_type === "package" ? " avec une formule" : dog.payment_type === "direct" ? " via Stripe" : ""}` : "Non réglé"}</span>}
													</li>
												))}
											</ul>
										</div>
									) : null}
								</div>
							);
					  })
					: "Aucun élément pour l'instant"}
			</div>
		</>
	);
}
