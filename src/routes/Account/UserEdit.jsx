import { Slot } from "../../data/dashboard-form-data";
import Component from "../../components/AccountInfo";

function EditRoute() {
	return (
		<section>
			<div className='content'>
				<div className='box big-box'>
					<Component type='slot' rawformData={Slot} />
				</div>
			</div>
		</section>
	);
}

export { EditRoute as Component };
