import { useEffect } from "react";
import { useFetch } from "../hooks/useFetch";
import { NavLink, useParams, useNavigate } from "react-router-dom";
import { addToCart } from "../utils/utils.cart.jsx";

const encode = str => encodeURIComponent(str).replace(/%20/g, "+").replace(/\//g, "%2F");
const decode = str => decodeURIComponent((str || "").replace(/\+/g, " "));
function Packages() {
	const params = useParams();
	const navigate = useNavigate();
	const packages = useFetch("/get-all-packages");

	useEffect(() => {
		if (packages.data && !params.menu) {
			navigate(encode(packages.data.result[0].label));
		}
	}, [packages]);

	return (
		<section className='packages'>
			<div className='content'>
				<h2>Nos Formules</h2>

				<div className='flex-row no-wrap'>
					<div className='menu'>
						<ul>
							{packages.data?.result &&
								packages.data?.result.map((_package, index) => (
									<li key={index}>
										<NavLink to={`/formules-et-tarifs/${encode(_package.label)}`}>{_package.label}</NavLink>
									</li>
								))}
						</ul>
					</div>
					<div className='content widgets'>
						<div className='box'>
							<div className='title'>{decode(params.menu)}</div>
							<div className='content cards'>
								{packages.data?.result
									.filter((item, index) => item.label === decode(params.menu))
									.map((_package, index) => (
										<div className='card' key={index}>
											<div className=''>{_package.description}</div>
											<div className='top-line margin-t-20'>Activités inclues: </div>
											<div className='content'>
												{_package.activities.map(activity => (
													<div className='row' key={activity.id}>
														{activity.label}
													</div>
												))}
											</div>
											<div className='bottom-line'>
												{_package.number_of_session} séances - {_package.price}€ - Durée de validité {_package.validity_period} mois
											</div>

											<div className='center margin-t-10'>
												<button
													onClick={event => {
														addToCart({ type: "package", id: _package.id, element: event.target });
													}}>
													Ajouter au panier
												</button>
											</div>
										</div>
									))}
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}

export { Packages as Component };
