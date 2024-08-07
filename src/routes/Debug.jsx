import { useFetch } from "../hooks/useFetch";
import browserDetect from "browser-detect";
import "./Debug.css";

function Debug() {
	const isLoggedIn = useFetch("/is-logged-in");
	const result = browserDetect();

	return (
		<section className='debug'>
			<div className='content'>
				<div className='box left'>
					<p>Data:</p>
					<pre>{JSON.stringify(isLoggedIn.data, null, 4)}</pre>
				</div>
				<br />
				<div className='box left'>
					<p>Error:</p>
					<pre>{JSON.stringify(isLoggedIn.error, null, 4)}</pre>
				</div>
				<br />
				<div className='box left'>
					<p>Cookies:</p>
					<pre>{document.cookie.toString()}</pre>
				</div>
				<br />
				<div className='box left'>
					<p>UA:</p>
					<pre>{JSON.stringify(result, null, 4)}</pre>
				</div>
			</div>
		</section>
	);
}

export { Debug as Component };
