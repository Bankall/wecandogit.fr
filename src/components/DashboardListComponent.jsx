import { useFetch } from "../hooks/useFetch";
import { Link } from "react-router-dom";

export default function DashboardListComponent({ type, title, addLabel }) {
	const response = useFetch(`/${type}`);

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
									<Link to={`/account/${type}/edit/${item.id}`}>
										<button className='small'>Modifier</button>
									</Link>
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
