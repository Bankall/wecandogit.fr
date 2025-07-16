import { ActivityDetail } from "../components/ActivityDetail";
import { Link } from "react-router-dom";

function Component() {
	return (
		<>
			<ActivityDetail id={10} activities={[10, 11, 44]} photos={["/assets/medias/DSCF1305.min.png", "/assets/medias/DSCF1305.min.png", "/assets/medias/DSCF1305.min.png"]}>
				<Link to={`/activites/sports-canins`} className='button small'>
					Retour aux sports canins
				</Link>
			</ActivityDetail>
		</>
	);
}

export { Component };
