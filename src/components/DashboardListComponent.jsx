import { Link, useParams } from "react-router-dom";
import axios from "axios";
import { useState, useEffect } from "react";

const formatDate = date => {
	date = new Date(date);
	return date.toLocaleString().slice(0, 16);
};

export default function DashboardListComponent({ type, title, addLabel, allowedActions }) {
	const [response, setResponse] = useState(false);
	const [filter, setFilter] = useState(false);

	const params = useParams();
	const handleDelete = async id => {
		try {
			await axios.put(`/${type}/${id}`, { enabled: 0 });
			window.dispatchEvent(new Event(`refresh-list-${type}`));
		} catch (err) {
			console.error(err);
		}
	};

	useEffect(() => {
		const fetch = async () => {
			try {
				const response = await axios.get(`/${type}`);
				setResponse(response);
			} catch (err) {
				console.error(err);
			}
		};

		fetch();
		window.addEventListener(`refresh-list-${type}`, fetch);

		setFilter(false);

		return () => {
			window.removeEventListener(`refresh-list-${type}`, fetch);
		};
	}, [params]);

	if (!allowedActions) {
		allowedActions = ["modify"];
	}

	return (
		<>
			<div className='title'>{title}</div>
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
					<Link className='margin-b-20' to={`/account/${type}/create`}>
						<button>{addLabel}</button>
					</Link>
				)}

				{response.data?.length
					? response.data.map((item, index) => {
							if (filter) {
								const words = filter.split(/\s/);
								const fullString = `${item.date ? formatDate(item.date) : ""} ${item.group_label || ""} ${item.label}`;
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
								<div className='row flex-row' key={index}>
									<span className='list-detail'>
										{item.date ? `${formatDate(item.date)} - ` : ""}
										{item.group_label ? (
											<>
												{item.date ? (
													<>
														<b>{item.group_label}</b> - {item.label}
													</>
												) : (
													<>
														{item.group_label} - <b>{item.label}</b>
													</>
												)}
											</>
										) : (
											item.label
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

									{allowedActions.includes("delete") && (
										<button
											className='small'
											onClick={() => {
												handleDelete(item.id);
											}}>
											Supprimer
										</button>
									)}
								</div>
							);
					  })
					: "Aucun élément pour l'instant"}
			</div>
		</>
	);
}
