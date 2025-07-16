import { useEffect } from "react";
import { useFetch } from "../hooks/useFetch";
import { NavLink, useParams, useNavigate } from "react-router-dom";
import { Interweave } from "interweave";
import { UrlMatcher } from "interweave-autolink";
import { encode, decode } from "../utils/utils.encode";

function ListAllActivities() {
	const params = useParams();
	const navigate = useNavigate();
	const activities = useFetch("/get-all-activities");

	useEffect(() => {
		if (activities.data && !params.menu) {
			navigate(encode(activities.data.result[0].label));
		}
	}, [activities]);

	return (
		<section className='activities'>
			<div className='content'>
				<h2>Nos Activités</h2>

				<div className='flex-row no-wrap'>
					<div className='menu'>
						<ul>
							{activities.data?.result &&
								activities.data?.result.map((activity_group, index) => (
									<li key={index}>
										<NavLink to={`/activites/${encode(activity_group.label)}`}>{activity_group.label}</NavLink>
									</li>
								))}
						</ul>
					</div>
					<div className='content widgets'>
						<div className='box'>
							<div className='title'>{decode(params.menu)}</div>
							<div className='content cards'>
								{params.menu &&
									activities.data?.result
										.filter((item, index) => decode(params.menu) === item.label)[0]
										.activities.map((activity, index) => (
											<div className='card' key={index}>
												<div className='top-line'>{activity.label}</div>
												<div className='content'>
													<Interweave content={activity.long_description || activity.description} newWindow={true} matchers={[new UrlMatcher("url")]} />
												</div>
												<div className='bottom-line'>
													{activity.spots > 1 ? `${activity.spots} places` : "Activité individuelle"} - {activity.price}€ la séance
												</div>
											</div>
										))}
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}

export { ListAllActivities as Component };
