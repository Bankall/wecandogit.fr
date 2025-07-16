export const HeroLight = ({ children }) => {
	return (
		<section className='hero hero-light flex-row no-wrap'>
			<div className='flex-row flex-col align-center justify-center'>
				{children ? (
					children
				) : (
					<>
						<h1>We Can Dog It</h1>
						<h2 className='center'>Unies par l'amour du chien, guidées par la bienveillance</h2>
					</>
				)}
			</div>
		</section>
	);
};
