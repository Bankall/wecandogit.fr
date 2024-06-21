import { useFetch } from "../hooks/useFetch";
import { Link } from "react-router-dom";

export default function DashboardListComponent({ label, type }) {
	const response = useFetch(`/${type}`);
	const captitalize = word => {
		word = word.toString();
		return word.charAt(0).toUpperCase() + word.slice(1);
	};

	return (
		<>
			<div className='title'>{captitalize(label)}</div>
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
										<button>Modifier</button>
									</Link>
								</div>
							);
					  })
					: "Aucun élément pour l'instant"}
			</div>
			<Link to={`/account/${type}/create`}>
				<button>Ajouter une {label}</button>
			</Link>
		</>
	);
}
