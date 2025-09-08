import maintenance from "/assets/medias/Maintenance.jpg";

function Maintenance() {
	return (
		<>
			<section className='flex-row'>
				<div className='box big-box' style={{ padding: 0 }}>
					<img src={maintenance} alt='Maintenance' />
				</div>
			</section>
		</>
	);
}

export { Maintenance as Component };
