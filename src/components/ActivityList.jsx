import axios from "axios";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import Loading from "./Loading";

export default function ActivityListing({ endpoint }) {
	const [response, setResponse] = useState({ loading: true });

	useEffect(() => {
		const fetch = () => {
			axios
				.get(endpoint)
				.then(res => setResponse(res.data))
				.catch(err => console.error(err));
		};

		const interval = setInterval(() => {
			fetch();
		}, 10000);

		fetch();
		return () => clearInterval(interval);
	}, []);

	return (
		<>
			{!response.loading && response.length ? (
				response.map(row => {
					return (
						<div className='row' key={row.id}>
							<span className='date-detail'>
								{row.date} - {row.time}:
							</span>
							<span className='list-detail'>
								{row.name} ({row.trainer})
							</span>
							<Link to={`/book-activity/${row.id}`}>
								<button>Réserver</button>
							</Link>
						</div>
					);
				})
			) : (
				<Loading />
			)}
		</>
	);
}
