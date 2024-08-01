import FullCalendar from "@fullcalendar/react";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import frLocale from "@fullcalendar/core/locales/fr";
import axios from "axios";

import "./Agenda.css";
import { useEffect, useRef, useState } from "react";
import { instantBooking, addToCart } from "../utils/utils.cart";
import { Link, useParams } from "react-router-dom";
import { Button } from "../components/Button";
import { useCookies } from "react-cookie";

const renderEventContent = (eventInfo, cookies) => {
	const data = Object.assign({}, eventInfo.event.extendedProps);
	const full = (data.reservations || []).length >= data.spots;

	return (
		<>
			<span className='flex-row'>
				<i id={data.id_slot}>
					<span>
						<b>{data.label}</b> - ({data.firstname}) - <b>{full ? "Complet" : `${(data.reservations || []).length}/${data.spots}`}</b>
					</span>

					{data.reservations && data.reservations.length && (
						<ul>
							{data.reservations.map((dog, index) => (
								<li key={index}>{dog ? dog.replace(" ( )", "") : "Anonyme"}</li>
							))}
						</ul>
					)}
				</i>

				<span className='flex-row small-gap'>
					{data.instant_reservation ||
						(false && (
							<Button
								className='small disabled'
								onClick={() => {
									instantBooking({
										type: "slot",
										id: data.id_slot
									});
								}}>
								Réserver
							</Button>
						))}

					{data.is_mine ? (
						<Link to={`/account/slots/filter/${data.id_slot}`}>
							<button className='small'>Modifier</button>
						</Link>
					) : null}

					<Button
						className={`small${full || data.reserved ? " disabled" : ""}`}
						onClick={() => {
							addToCart({
								type: "slot",
								id: data.id_slot
							});
						}}>
						Ajouter au panier
					</Button>
				</span>
			</span>
		</>
	);
};

const convertToLocalDate = (date, increment) => {
	console.log(date, increment);
	const converted = new Date(date.replace(/T|Z/g, " "));

	if (increment) {
		converted.setTime(converted.getTime() + increment * 1000 * 60);
	}
	console.log(converted, converted.toISOString());
	return converted.toISOString();
};

const getEventColor = firstname => {
	return firstname === "Elodie" ? "rgb(33, 70, 144)" : "rgb(112, 33, 111)";
};

const fetchEvents = async setEvents => {
	try {
		const slots = await axios.get("get-all-slots");
		const mapped = slots.data.result.map(slot => {
			const result = { ...slot };

			result.start = convertToLocalDate(slot.date);
			result.end = convertToLocalDate(slot.date, slot.duration);

			result.backgroundColor = getEventColor(slot.firstname);

			return result;
		});

		setEvents(mapped);
	} catch (err) {
		console.error(err);
	}
};

export default function Agenda() {
	const [events, setEvents] = useState([]);
	const [once, setOnce] = useState(true);
	const [cookies, setCookies] = useCookies();
	const [initialDate, setInitialDate] = useState(new Date());
	const params = useParams();

	const Calendar = useRef();

	const NoEventRender = () => {
		const calendarApi = Calendar.current?.getApi();

		if (calendarApi && events.length && once && !(params.year && params.week)) {
			calendarApi.gotoDate(events[0].start);
			setOnce(false);

			return;
		}

		return "Aucun évènement à afficher";
	};

	useEffect(() => {
		const buttons = Array.from(document.querySelectorAll(".fc-button"));
		buttons.forEach(button => {
			button.addEventListener("click", () => {
				document.querySelector(".agenda").scrollIntoView({ behavior: "smooth" });
			});
		});

		const fetch = () => {
			fetchEvents(setEvents);
		};

		fetch();
		window.addEventListener("reservations-made", fetch);
		return () => window.removeEventListener("reservations-made", fetch);
	}, []);

	useEffect(() => {
		if (params.year && params.week) {
			const date = new Date(params.year, 0, 1 + (params.week - 1) * 7);
			const calendarApi = Calendar.current?.getApi();

			calendarApi.gotoDate(date);
		}
	}, [params]);

	return (
		<section className='agenda'>
			<FullCalendar
				ref={Calendar}
				locale={frLocale}
				height='auto'
				expandRows={true}
				selectable={true}
				plugins={[listPlugin, interactionPlugin]}
				noEventsContent={NoEventRender}
				initialView={"listWeek"}
				events={events}
				eventContent={eventInfo => renderEventContent(eventInfo, cookies)}
				scrollTime={false}
				footerToolbar={{
					start: "title",
					center: "",
					end: "today prev,next"
				}}
			/>
		</section>
	);
}

export { Agenda as Component };
