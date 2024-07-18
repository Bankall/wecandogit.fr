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

export default function DashboardListComponent({ type, title, addLabel, allowedActions, id_user }) {
	const [response, setResponse] = useState(false);
	const [filter, setFilter] = useState(false);
	const [extraTitle, setExtraTitle] = useState(false);

	const params = useParams();
	const handleDelete = async (id, typeOverride) => {
		try {
			await axios.put(`/${typeOverride || type}/${id}`, { enabled: 0 });
			window.dispatchEvent(new Event(`refresh-list-${type}`));
		} catch (err) {
			console.error(err);
		}
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
				{response.data?.length && response.data?.length > 10 ? (
					<div className='filter-box margin-b-20'>
						<input
							type='text'
							onKeyUp={event => {
								setFilter(event.target.value);
							}}
							placeholder='Filtrer les résultats'
							key={type}
						/>
					</div>
				) : null}

				{addLabel && (
					<Link className='margin-b-20' to={`/account/${type}/create${id_user ? `/${id_user}` : ""}`}>
						<button>{addLabel}</button>
					</Link>
				)}

				{response.data?.length
					? response.data.map((item, index) => {
							if (filter) {
								const words = filter.split(/\s/).map(word => word.toLowerCase());
								const fullString = `${item.date ? formatDate(item.date) : ""} ${item.group_label || ""} ${item.label}`.toLowerCase();

								let everyWordsMatch = true;

								words.forEach(word => {
									if (!fullString.includes(word)) {
										everyWordsMatch = false;
									}
								});

								if (!everyWordsMatch) {
									return <div key={index}></div>;
								}
							}

							return (
								<div className='row' key={index}>
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

										{(allowedActions.includes("delete") || (allowedActions.includes("delete-24") && isNotTooLate(item.date))) && (
											<i
												className='fa-solid fa-trash-can'
												aria-hidden='true'
												style={{ color: "var(--invalid-color)", cursor: "pointer" }}
												onClick={() => {
													handleDelete(item.id);
												}}></i>
										)}
									</div>

									{item.dogs && item.dogs.length ? (
										<div>
											<ul>
												{item.dogs.map((dog, index) => (
													<li key={index} className='flex-row'>
														{dog.id && (
															<i
																className='fa-solid fa-trash-can'
																aria-hidden='true'
																style={{ color: "var(--invalid-color)", cursor: "pointer" }}
																onClick={() => {
																	handleDelete(dog.id, "reservation");
																}}></i>
														)}
														{dog.label}
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
