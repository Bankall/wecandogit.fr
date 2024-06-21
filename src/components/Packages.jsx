import { useFetch } from "../hooks/useFetch";
import { Link } from "react-router-dom";

export default function Packages() {
	const packages = useFetch("/my-packages");

	return (
		<>
			<Link to='/account/packages/create'>
				<button>Ajouter une formule</button>
			</Link>

			<div className='listing'>
				{packages.data?.result?.length
					? packages.data.result.map(_package => {
							return <div>${_package.label}</div>;
					  })
					: "Aucune formule pour l'instant"}
			</div>
		</>
	);
}
