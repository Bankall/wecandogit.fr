import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import listPlugin from "@fullcalendar/list";
import timeGridPlugin from "@fullcalendar/timegrid";
import frLocale from "@fullcalendar/core/locales/fr";
import axios from "axios";

import "./Agenda.css";
import { useEffect, useState } from "react";

export default function Agenda() {
	const [events, setEvents] = useState([]);
	useEffect(() => {
		const fetch = async () => {
			try {
				const slots = await axios.get("get-all-slots");
				const mapped = slots.data.result.map(slot => {
					return {
						id: slot.id,
						title: slot.label,
						start: slot.date,
						end: (() => {
							const end = new Date(slot.date);
							end.setTime(end.getTime() + slot.duration * 1000 * 60);
							return end.toISOString();
						})()
					};
				});

				setEvents(mapped);

				console.log(mapped);
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
			<FullCalendar locale={frLocale} plugins={[listPlugin, dayGridPlugin, timeGridPlugin]} initialView='dayGridMonth' events={events} />;
		</section>
	);
}

export { Agenda as Component };
