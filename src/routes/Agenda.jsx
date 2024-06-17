import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid"; // a plugin!

export default function Agenda() {
	return (
		<section className='agenda'>
			<FullCalendar plugins={[dayGridPlugin]} initialView='dayGridMonth' />;
		</section>
	);
}

export { Agenda as Component };
