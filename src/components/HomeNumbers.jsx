import { useRef, useEffect } from "react";
import { CountUp } from "countup.js";

const __YEARS = [3, 4]; // 3 years, 1 second
const __CLIENTS = [2151, 2]; // 8451 clients, 2 seconds
const __TREATS = [Date.now() / 1000 / 60 / 60, 5]; // 481554 treats, 5 seconds

const countUpOptions = {
	separator: " ",
	enableScrollSpy: true
};

const CountBuilder = values => {
	values = values.map(value => {
		const [ref, data] = value;
		const [target, duration] = data;

		const count = new CountUp(ref.current, target, Object.assign(countUpOptions, { duration }));
		count.start();

		return count;
	});

	return {
		reset: () => values.forEach(count => count.reset())
	};
};

export default function HomeNumbers() {
	const yearsRef = useRef(null);
	const clientsRef = useRef(null);
	const treatsRef = useRef(null);

	useEffect(() => {
		const counters = CountBuilder([
			[yearsRef, __YEARS],
			[clientsRef, __CLIENTS],
			[treatsRef, __TREATS]
		]);

		return () => {
			counters.reset();
		};
	}, []);

	return (
		<section className='numbers flex-row space-evenly no-wrap'>
			<div>
				<div>
					<img src='/assets/medias/dachshund.png' alt='Picture of a dachshund with a gift on his back' />
				</div>
				<div>
					<div className='title'>
						<span ref={yearsRef}></span>
						<span> ANS</span>
					</div>
					<div className='margin-t--10'>d'existence</div>
				</div>
			</div>

			<div>
				<div>
					<img src='/assets/medias/corgi.png' alt='Picture corgi' />
				</div>
				<div>
					<div className='title'>
						<span ref={clientsRef}></span>
					</div>
					<div className='margin-t--10'>clients satisfaits</div>
				</div>
			</div>

			<div>
				<div>
					<img src='/assets/medias/treats.png' alt='Picture of a jar of dog treats' />
				</div>
				<div>
					<div className='title'>
						<span ref={treatsRef}></span>
					</div>
					<div className='margin-t--10'>friandises distribuées</div>
				</div>
			</div>
		</section>
	);
}
