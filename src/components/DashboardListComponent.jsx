import { Link, useLocation } from "react-router-dom";
import axios from "axios";
import { useState, useEffect } from "react";

export default function DashboardListComponent({ type, title, addLabel, allowedActions }) {
	const [response, setResponse] = useState(false);
	const hash = useLocation();
	const handleDelete = async id => {
		try {
			const response = await axios.put(`/${type}/${id}`, { enabled: 0 });
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

		return () => {
			window.removeEventListener(`refresh-list-${type}`, fetch);
		};
	}, [hash]);

	if (!allowedActions) {
		allowedActions = ["modify"];
	}

	return (
		<>
			<div className='title'>{title}</div>
			<div className='content'>
				{response.data?.length
					? response.data.map(item => {
							return (
								<div className='row' key={item.id}>
									<span className='list-detail'>
										{item.group_label ? `${item.group_label} - ` : ""}
										{item.label}
									</span>
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
			{addLabel && (
				<Link to={`/account/${type}/create`}>
					<button>{addLabel}</button>
				</Link>
			)}
		</>
	);
}
