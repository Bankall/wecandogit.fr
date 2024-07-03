import { useState, useEffect } from "react";
import { useFetch } from "../hooks/useFetch";
import { useLocation } from "react-router-dom";

function ListAllActivities() {
	const location = useLocation();
	const activities = useFetch("/get-all-activities");
	const [currentMenu, setCurrentMenu] = useState(location.hash ? decodeURIComponent(location.hash.slice(1)) : false);

	useEffect(() => {
		if (activities.data && !currentMenu) {
			setCurrentMenu(activities.data.result[0].label);
		}
	}, [activities]);

	const onMenuClick = event => {
		const name = event.target.getAttribute("name");
		if (!name) {
			return;
		}

		setCurrentMenu(name);
		window.location.hash = `#${name}`;
	};

	return (
		<section className='activities'>
			<div className='content'>
				<h2>Nos Activités</h2>

				<div className='dashboard flex-row no-wrap'>
					<div className='menu'>
						<ul onClick={onMenuClick}>
							{activities.data?.result &&
								activities.data?.result.map((activity_group, index) => (
									<li name={activity_group.label} className={currentMenu === activity_group.label ? "active" : ""} key={index}>
										{activity_group.label}
									</li>
								))}
						</ul>
					</div>
					<div className='content widgets'>
						<div className='box'>
							<div className='title'>{currentMenu}</div>
							<div className='content cards'>
								{currentMenu &&
									activities.data?.result
										.filter((item, index) => currentMenu === item.label)[0]
										.activites.map((activity, index) => (
											<div className='card' key={index}>
												<div className='top-line'>{activity.label}</div>
												<div className='content'>{activity.long_description || activity.description}</div>
												<div className='bottom-line'>
													{activity.spots ? `${activity.spots} places` : "Activité individuelle"} - {activity.price}€ la séance
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
