import { useFetch } from "/src/hooks/useFetch";
import { Navigate } from "react-router-dom";
export default function Account() {
	const isLoggedIn = useFetch("/is-logged-in");
	return (
		<>
			{false && !isLoggedIn.loading && isLoggedIn.data && !isLoggedIn.data.result && <Navigate to='/login' />}
			Account page
		</>
	);
}
