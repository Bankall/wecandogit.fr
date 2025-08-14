import { ActivityDetail } from "../components/ActivityDetail";
import { Link } from "react-router-dom";

function Component() {
	return (
		<>
			<ActivityDetail id={12} activities={[12, 51, 44]} photos={["/assets/medias/mantrailing1.jpg", "/assets/medias/mantrailing2.jpg", "/assets/medias/mantrailing4.jpg", "/assets/medias/mantrailing3.jpg"]}>
				<Link to={`/activites/sports-canins`} className='button small'>
					Retour aux sports canins
				</Link>
			</ActivityDetail>
		</>
	);
}

export { Component };
