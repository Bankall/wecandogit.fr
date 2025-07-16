import { HeroLight } from "../components/HeroLight";
import { useFetch } from "../hooks/useFetch";
import { Interweave } from "interweave";
import { Activity } from "./Activity";

export const ActivityDetail = ({ id, photos, activities, children }) => {
	const { data } = useFetch(`/public-activity/${id}`);

	return (
		<>
			<HeroLight>
				<h1>{data?.header}</h1>
			</HeroLight>
			<section className='all-activities' id='nos-activites'>
				{photos && (
					<div className='content flex-row no-wrap md-wrap justify-center width-50 gap-50'>
						{photos.map((photo, index) => (
							<img key={index} src={photo} alt={data?.label} className='squared-picture align-self-center' />
						))}
					</div>
				)}

				<div className='content margin-t-50'>
					<Interweave content={data?.product_page_description || data?.long_description} />
				</div>

				{activities && (
					<div className='content flex-row no-wrap md-wrap align-normal width-50 margin-t-50 gap-50'>
						{activities.map((activity, index) => (
							<Activity key={index} id={activity} light={true} />
						))}
					</div>
				)}

				<div className='flex-row margin-t-50 justify-center'>
					<div className='button small flex-no-grow'>{children}</div>
				</div>
			</section>
		</>
	);
};
