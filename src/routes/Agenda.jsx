import FullCalendar from "@fullcalendar/react";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import frLocale from "@fullcalendar/core/locales/fr";
import axios from "axios";

import "./Agenda.css";
import { useEffect, useRef, useState } from "react";

const renderEventContent = eventInfo => {
	console.log(eventInfo.event.id);
	return (
		<>
			<b>{eventInfo.timeText}</b>
			<i>{eventInfo.event.title}</i>
		</>
	);
};

export default function Agenda() {
	const [events, setEvents] = useState([]);
	const [once, setOnce] = useState(true);

	const Calendar = useRef();

	useEffect(() => {
		const fetch = async () => {
			try {
				const slots = await axios.get("get-all-slots");
				const mapped = slots.data.result.map(slot => {
					return {
						id: slot.id,
						title: slot.label,
						start: slot.date,
						timeText: "toto",
						end: (() => {
							const end = new Date(slot.date.replace(/T/, " ").slice(0, -1));
							end.setTime(end.getTime() + slot.duration * 1000 * 60);
							return end.toISOString();
						})()
					};
				});

				setEvents(mapped);
			} catch (err) {
				console.error(err);
			}
		};

		const interval = setInterval(() => {
			fetch();
		}, 10000);

		fetch();
		return () => clearInterval(interval);
	}, []);

	return (
		<section className='agenda'>
			<FullCalendar
				ref={Calendar}
				locale={frLocale}
				height='auto'
				expandRows={true}
				selectable={true}
				plugins={[listPlugin, interactionPlugin]}
				noEventsContent={() => {
					const calendarApi = Calendar.current?.getApi();

					if (calendarApi && events.length && once) {
						calendarApi.gotoDate(events[0].start);
						setOnce(false);

						return;
					}

					return "Aucun évènement à afficher";
				}}
				initialView={"listWeek"}
				events={events}
				eventContent={renderEventContent}
			/>
		</section>
	);
}

export { Agenda as Component };
