import { useCookies } from "react-cookie";

export default function Account() {
	const [cookies, setCookies] = useCookies();
	console.log(cookies);
	return (
		<section className='account'>
			<div className='content'>
				<h2>Hello {cookies.username} !</h2>
			</div>
		</section>
	);
}

export { Account as Component };
