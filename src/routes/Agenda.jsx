import FullCalendar from "@fullcalendar/react";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import frLocale from "@fullcalendar/core/locales/fr";
import axios from "axios";

import "./Agenda.css";
import { useEffect, useRef, useState } from "react";
import { instantBooking, addToCart } from "../utils/utils.cart";
import { Button } from "../components/Button";

const renderEventContent = eventInfo => {
	const data = Object.assign({}, eventInfo.event.extendedProps);
	const full = (data.reservations || []).length >= data.spots;

	return (
		<>
			<span className='flex-row'>
				<i>
					<span>
						{data.label} - ({data.firstname}) - {(data.reservations || []).length}/{data.spots}
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
	const converted = new Date(date.replace(/T|Z/g, " "));

	if (increment) {
		converted.setTime(converted.getTime() + increment * 1000 * 60);
	}

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

	const Calendar = useRef();

	const NoEventRender = () => {
		const calendarApi = Calendar.current?.getApi();

		if (calendarApi && events.length && once) {
			calendarApi.gotoDate(events[0].start);
			setOnce(false);

			return;
		}

		return "Aucun évènement à afficher";
	};

	useEffect(() => {
		const fetch = () => {
			fetchEvents(setEvents);
		};

		fetch();
		window.addEventListener("reservations-made", fetch);
		return () => window.removeEventListener("reservations-made", fetch);
	}, []);

	return (
		<section className='agenda'>
			<FullCalendar ref={Calendar} locale={frLocale} height='auto' expandRows={true} selectable={true} plugins={[listPlugin, interactionPlugin]} noEventsContent={NoEventRender} initialView={"listWeek"} events={events} eventContent={renderEventContent} />
		</section>
	);
}

export { Agenda as Component };
