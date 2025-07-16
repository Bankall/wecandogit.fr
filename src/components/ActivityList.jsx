import axios from "axios";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import Loading from "./Loading";

const parseDate = date => {
	date = new Date(date.replace(/-/g, "/"));
	return `${date.toLocaleDateString().slice(0, -5)} - ${date.getHours()}h`;
};

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
			{response.result?.length ? (
				response.result.map(row => {
					return (
						<div className='row' key={row.id}>
							<span className='date-detail'>{parseDate(row.date)}</span>
							<span className='list-detail'>
								{row.label} ({row.firstname})
							</span>
						</div>
					);
				})
			) : (
				<Loading />
			)}
		</>
	);
}
