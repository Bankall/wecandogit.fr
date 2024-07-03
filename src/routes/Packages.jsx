import { useEffect, useState } from "react";
import { useFetch } from "../hooks/useFetch";
import { useLocation } from "react-router-dom";
import { addToCart } from "../utils/utils.cart.jsx";

function Packages() {
	const location = useLocation();
	const packages = useFetch("/get-all-packages");
	const [currentMenu, setCurrentMenu] = useState(location.hash ? decodeURIComponent(location.hash.slice(1)) : false);

	useEffect(() => {
		if (packages.data && !currentMenu) {
			setCurrentMenu(packages.data.result[0].label);
		}
	}, [packages]);

	const onMenuClick = event => {
		const name = event.target.getAttribute("name");
		if (!name) {
			return;
		}

		setCurrentMenu(name);
		window.location.hash = `#${name}`;
	};

	return (
		<section className='packages'>
			<div className='content'>
				<h2>Nos Formules</h2>

				<div className='dashboard flex-row no-wrap'>
					<div className='menu'>
						<ul onClick={onMenuClick}>
							{packages.data?.result &&
								packages.data?.result.map((_package, index) => (
									<li name={_package.label} className={currentMenu === _package.label ? "active" : ""} key={index}>
										{_package.label}
									</li>
								))}
						</ul>
					</div>
					<div className='content widgets'>
						<div className='box'>
							<div className='title'>{currentMenu}</div>
							<div className='content cards'>
								{packages.data?.result
									.filter((item, index) => item.label === currentMenu)
									.map((_package, index) => (
										<div className='card' key={index}>
											<div className='top-line'>Activités inclues: </div>
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
													onClick={() => {
														addToCart({ type: "package", id: _package.id });
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
