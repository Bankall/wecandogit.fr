import { Link } from "react-router-dom";
import { useFetch } from "../hooks/useFetch";
import { Interweave } from "interweave";

const formatDuration = duration => {
	if (duration === 60) return "1 heure";
	if (duration < 60) return `${duration} minutes`;
	if (duration % 60 === 0) return `${duration / 60} heures`;
	const hours = Math.floor(duration / 60);
	const minutes = duration % 60;

	return `${hours}h${minutes}`;
};

const formatSpots = spots => {
	return spots === 1 ? "Activité individuelle" : `${spots} places`;
};

const Activity = ({ id, image, link, light }) => {
	const { data } = useFetch(`/public-activity/${id}`);

	return (
		<div className='box flex-col'>
			{[45, 44].includes(id) && <img src='/assets/medias/achieve.png' style={{ width: 40, alignSelf: "center" }} />}
			{[52].includes(id) && <img src='/assets/medias/surfboard.png' style={{ width: 40, alignSelf: "center" }} />}
			{[10, 11].includes(id) && <img src='/assets/medias/dog-nose.png' style={{ width: 40, alignSelf: "center" }} />}
			{[12, 51].includes(id) && <img src='/assets/medias/police-dog.png' style={{ width: 40, alignSelf: "center" }} />}
			{[28, 29, 46].includes(id) && <img src='/assets/medias/dog-training.png' style={{ width: 40, alignSelf: "center" }} />}
			{image && <img src={image} alt={data?.label} className='squared-picture align-self-center' />}

			<div className='title'>{light ? data?.label : data?.header || data?.label}</div>
			{!light && (
				<div className='content flex-col left flex-grow'>
					<Interweave content={data && link ? data.product_page_short_description || data.description : data ? data.product_page_short_description || data.long_description : null} />
				</div>
			)}

			{data && !link && (data.sports || data.price) && (
				<div className={`${light ? "flex-col" : "flex-row"} gap-10 font-size-11 justify-center margin-t-20`}>
					{data?.spots && (
						<span className='flex-row gap-5'>
							<span className='icon paw-icon'></span>
							{formatSpots(data.spots)}
						</span>
					)}

					{data?.duration && (
						<span className='flex-row gap-5'>
							<span className='icon clock-icon'></span>
							Durée : {formatDuration(data.duration)}
						</span>
					)}

					{data?.price && (
						<span className='flex-row gap-5'>
							<span className='icon shopping-icon'></span>
							{data.price} € la séance
						</span>
					)}
				</div>
			)}

			{light && (
				<div className='flex-col gap-10 align-left margin-t-20 flex-grow'>
					{data?.card_footer && (
						<div className='left'>
							<Interweave content={data.card_footer} />
						</div>
					)}
				</div>
			)}

			{data && (
				<div className='button small align-self-center margin-t-20'>
					<Link to={link || `/agenda`} className='button small'>
						{link ? "En savoir plus" : "Réserver"}
					</Link>
				</div>
			)}
		</div>
	);
};

export { Activity };
