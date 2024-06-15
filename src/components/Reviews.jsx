import { useFetch } from "../hooks/useFetch";
import { Interweave } from "interweave";
export default function Reviews() {
	const reviews = useFetch("https://places.googleapis.com/v1/places/ChIJ8yRNHrKz7iUReSJcT90Ok7w?key=AIzaSyDtFaGeGR5rB75OjS-F5M1ZQn8xmrxkrGo&fields=reviews");

	return (
		<section className='reviews'>
			<h2>Ce qu'ils en pensent</h2>

			<div className='cards'>
				{reviews.data?.reviews
					? reviews.data?.reviews.map((review, index) => {
							return (
								<div className='card' key={`review-${index}`}>
									<div className='top-line'>
										<div className='stars-wrapper'>
											<div className='stars-active' style={{ width: `${(review.rating / 5) * 100}%` }}>
												{review.rating} étoiles
											</div>
											<div className='stars-inactive' style={{ width: `${100 - (review.rating / 5) * 100}%` }}></div>
										</div>
										<div className='timestamp'>{review.relativePublishTimeDescription}</div>
									</div>
									<div className='content'>
										<Interweave content={review.text.text} />
									</div>
									<div className='author'>{review.authorAttribution.displayName}</div>
								</div>
							);
					  })
					: null}
			</div>
		</section>
	);
}
