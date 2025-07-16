import { ActivityDetail } from "../components/ActivityDetail";
import { Link } from "react-router-dom";

function Component() {
	return (
		<>
			<ActivityDetail id={31}>
				<Link to={`/activites/education-reeducation`} className='button small'>
					Retour à l'éducation et rééducation
				</Link>
			</ActivityDetail>
		</>
	);
}

export { Component };
