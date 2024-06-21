import { useFetch } from "../hooks/useFetch";
import { Link } from "react-router-dom";

export default function Activities() {
	const activities = useFetch("/activity");

	return (
		<>
			<div class='title'>Mes activités</div>
			<div className='content'>
				{activities.data?.length
					? activities.data.map(activity => {
							return (
								<div className='row'>
									<span className='activity-detail'>
										{activity.group_label} - {activity.label}
									</span>
									<Link to={`/account/activity/edit/${activity.id}`}>
										<button>Modifier</button>
									</Link>
								</div>
							);
					  })
					: "Aucune formule pour l'instant"}
			</div>
			<Link to='/account/activity/create'>
				<button>Ajouter une activité</button>
			</Link>
		</>
	);
}
