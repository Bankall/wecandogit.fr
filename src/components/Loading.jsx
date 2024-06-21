import "./Loading.css";
export default function Loading() {
	return (
		<div className='loader-wrapper'>
			<div className='lds-ellipsis'>
				<div></div>
				<div></div>
				<div></div>
				<div></div>
			</div>
		</div>
	);
}
