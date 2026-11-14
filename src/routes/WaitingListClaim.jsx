import axios from "axios";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { CartContent } from "./Cart";
import { addToWaitingList } from "../utils/utils.cart";

/*
 * Landing page of a waiting-list offer mail ("une place s'est libérée").
 *
 * The slot goes into a cart of its own on the server (source "waiting-list"), so the
 * member picks the dog and the payment method exactly as in the regular cart,
 * without mixing it with whatever their regular cart already holds.
 * The spot is not held for them: if someone was quicker, they are told so here.
 */
const WAITING_LIST_SOURCE = "waiting-list";

const formatSlot = slot => {
	if (!slot || !slot.date) {
		return slot?.label || "";
	}

	const date = new Date(slot.date.replace(/-/g, "/"));
	return `${slot.label} du ${date.toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "2-digit" })} à ${date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
};

const Notice = ({ children }) => (
	<div className='widgets flex-col center'>
		<div className='box notice' style={{ maxWidth: "800px" }}>
			{children}
		</div>
	</div>
);

const SlotTaken = ({ slot }) => {
	const [rejoined, setRejoined] = useState(false);

	return (
		<Notice>
			Désolé, la place sur le créneau {formatSlot(slot)} a déjà été réservée par quelqu&apos;un d&apos;autre.
			<div className='margin-t-20 center'>
				{rejoined ?
					"Vous êtes de nouveau sur la liste d'attente : nous vous préviendrons si une place se libère."
				:	<button
						onClick={async () => {
							const response = await addToWaitingList({ id_slot: slot.id_slot });
							setRejoined(!!response?.ok);
						}}>
						Me remettre sur la liste d&apos;attente
					</button>
				}
			</div>
		</Notice>
	);
};

function WaitingListClaim() {
	const { id } = useParams();
	const { pathname } = useLocation();
	const navigate = useNavigate();
	const [claim, setClaim] = useState(null);

	useEffect(() => {
		let exited = false;

		(async () => {
			try {
				const { data } = await axios.post(`/cart/waiting-list/${id}`);

				if (exited) {
					return;
				}

				// Back here once logged in: the cart needs the member's dogs and packages
				if (data.login) {
					return navigate(`/login?next=${encodeURIComponent(pathname)}`, { replace: true });
				}

				setClaim(data);
			} catch (err) {
				if (!exited) {
					setClaim({ error: "Une erreur s'est produite" });
				}
			}
		})();

		return () => {
			exited = true;
		};
	}, [id]);

	const renderContent = () => {
		if (!claim) {
			return <Notice>Chargement…</Notice>;
		}

		if (claim.error) {
			return (
				<Notice>
					{claim.error}
					<div className='margin-t-20 center'>
						<Link to='/agenda'>
							<button>Voir l&apos;agenda</button>
						</Link>
					</div>
				</Notice>
			);
		}

		if (claim.full) {
			return <SlotTaken slot={claim.slot} />;
		}

		if (claim.unavailable) {
			return <Notice>Le créneau {formatSlot(claim.slot)} n&apos;est plus disponible.</Notice>;
		}

		if (claim.already_booked) {
			return (
				<Notice>
					Vous avez déjà réservé le créneau {formatSlot(claim.slot)}.
					<div className='margin-t-20 center'>
						<Link to='/account/reservations'>
							<button>Mes réservations</button>
						</Link>
					</div>
				</Notice>
			);
		}

		return (
			<>
				<p className='center'>Une place s&apos;est libérée sur le créneau {formatSlot(claim.slot)}. Choisissez votre chien et votre moyen de paiement pour la réserver.</p>
				<CartContent source={WAITING_LIST_SOURCE} loginPath={`/login?next=${encodeURIComponent(pathname)}`} emptyLabel='Cette réservation a déjà été traitée' />
			</>
		);
	};

	return (
		<section className='cart'>
			<div className='content'>
				<h2>Liste d&apos;attente</h2>
				{renderContent()}
			</div>
		</section>
	);
}

export { WaitingListClaim as Component };
