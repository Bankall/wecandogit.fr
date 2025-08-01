import { ActivityDetail } from "../components/ActivityDetail";
import { Link } from "react-router-dom";

function Component() {
	return (
		<>
			<ActivityDetail id={52} activities={[52]} photos={["/assets/medias/canipaddle1.jpg", "/assets/medias/canipaddle2.jpg", "/assets/medias/canipaddle3.jpg"]}>
				<Link to={`/activites/sports-canins`} className='button small'>
					Retour aux sports canins
				</Link>
			</ActivityDetail>
		</>
	);
}

export { Component };
