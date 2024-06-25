import { useFetch } from "../hooks/useFetch";
import "./ListAllActivities.css";

export function ListAllActivities() {
	const activities = useFetch("/get-all-activities");

	return (
		<section className='activities'>
			<div className='content'>
				<h2>Nos Activités</h2>
			</div>

			{activities.data?.result &&
				activities.data?.result.map((activity_group, index) => (
					<section key={index}>
						<h2>{activity_group.label}</h2>
						<div className='cards flex-row'>
							{activity_group.activites.map((activity, index) => (
								<div className='card' key={index}>
									<div className='top-line'>{activity.label}</div>
									<div className='content'>{activity.description}</div>
									<div className='bottom-line'>
										{activity.spots ? `${activity.spots} places` : "Activité individuelle"} - {activity.price}€ la séance
									</div>
								</div>
							))}
						</div>
					</section>
				))}
		</section>
	);
}

export { ListAllActivities as Component };
