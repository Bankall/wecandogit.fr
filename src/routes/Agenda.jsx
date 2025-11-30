import FullCalendar from "@fullcalendar/react";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import frLocale from "@fullcalendar/core/locales/fr";
import axios from "axios";

import "./Agenda.css";
import { useEffect, useRef, useState } from "react";
import { instantBooking, addToCart, addToWaitingList } from "../utils/utils.cart";
import { Link, useParams } from "react-router-dom";
import { Button } from "../components/Button";
import { useCookies } from "react-cookie";
import { useFetch } from "../hooks/useFetch";

const renderEventContent = (eventInfo, isLoggedIn) => {
	const data = Object.assign({}, eventInfo.event.extendedProps);
	const full = (data.reservations || []).length >= data.spots;
	const availableSpots = data.spots - (data.reservations || []).length;

	return (
		<>
			<span className='flex-row'>
				<i id={data.id_slot}>
					<span>
						<b>{data.label}</b> - ({data.firstname}) - <b className='nbsp'>{full ? "Complet" : availableSpots === 1 ? "1 place disponible" : `${availableSpots} places disponibles`}</b>
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

					{!data.cantBeReserved && !full ? (
						<Button
							className={`small inverted-colors`}
							disableOnClick={response => {
								if (response.cantAddMore) {
									return true;
								}
							}}
							onClick={async setContent => {
								return await addToCart({
									type: "slot",
									id: data.id_slot
								});
							}}>
							Ajouter au panier
						</Button>
					) : full && !data.waiting && isLoggedIn.data && isLoggedIn.data.ok ? (
						<Button
							className={`small`}
							disableOnClick={true}
							onClick={async setContent => {
								return await addToWaitingList({
									id_slot: data.id_slot
								});
							}}>
							S'inscrire sur liste d'attente
						</Button>
					) : null}
				</span>
			</span>
		</>
	);
};

const convertToLocalDate = (date, increment) => {
	const converted = new Date(date.replace(/-/g, "/").replace(/T|Z/g, " "));

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

const getUniqueEvents = events => {
	if (!events || !events.length) {
		return [];
	}

	const unique = events.map(event => event.label).filter(event => event !== "NE PAS UTILISER");
	return Array.from(new Set(unique));
};

export default function Agenda() {
	const [events, setEvents] = useState([]);
	const [once, setOnce] = useState(true);
	const [toggleFilters, setToggleFilters] = useState(false);
	const isLoggedIn = useFetch("/is-logged-in");
	const [filters, setFilters] = useState(() => {
		const filters = localStorage.getItem("agenda-filters");
		return filters && JSON.parse(filters) && JSON.parse(filters).events
			? JSON.parse(filters)
			: {
					trainers: {
						35: true,
						34: true,
						1: false
					},
					full: false,
					disable: false,
					events: {}
			  };
	});

	const [cookies, setCookies] = useCookies();
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

	const filterEvents = events => {
		if (filters.disable) {
			return events;
		}

		const hasAtLeastOneEventFilter = Object.values(filters.events).some(filter => filter);
		const hasAtLeastOneTrainerFilter = Object.values(filters.trainers).some(filter => filter);

		events = events.filter(event => !filters.full || (event.reservations || []).length < event.spots);

		if (hasAtLeastOneTrainerFilter) {
			events = events.filter(event => filters.trainers[event.id_trainer]);
		}

		if (!Object.keys(filters.events).length || !hasAtLeastOneEventFilter) {
			return events;
		}

		return events.filter(event => filters.events[event.label]);
	};

	const saveFilters = () => {
		const eventCheckboxes = document.querySelector(".filter-box .by-event").querySelectorAll("input[type=checkbox]");
		const trainerCheckboxes = document.querySelector(".filter-box .by-trainer").querySelectorAll("input[type=checkbox]");
		const filters = {
			events: {},
			trainers: {},
			disable: document.querySelector(".filter-box input[name=disable-filter]").checked,
			full: document.querySelector(".filter-box input[name=full-filter]").checked
		};

		eventCheckboxes.forEach(checkbox => {
			filters.events[checkbox.getAttribute("name")] = checkbox.checked;
		});

		trainerCheckboxes.forEach(checkbox => {
			filters.trainers[checkbox.getAttribute("name")] = checkbox.checked;
		});

		setFilters(filters);
		localStorage.setItem("agenda-filters", JSON.stringify(filters));
	};

	useEffect(() => {
		let fetchTimeout;
		const buttons = Array.from(document.querySelectorAll(".fc-button"));
		buttons.forEach(button => {
			button.addEventListener("click", () => {
				document.querySelector(".agenda").scrollIntoView({ behavior: "smooth" });
			});
		});

		const fetch = () => {
			fetchEvents(setEvents);
			fetchTimeout = setTimeout(fetch, 5000);
		};

		fetch();
		window.addEventListener("reservations-made", fetch);

		return () => {
			window.removeEventListener("reservations-made", fetch);
			clearTimeout(fetchTimeout);
		};
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
			<div
				className='margin-b-10'
				onClick={() => {
					setToggleFilters(!toggleFilters);
				}}>
				<i className='fa-solid fa-filter'></i>
				{toggleFilters ? " Cacher les filtres" : " Afficher les filtres"}
			</div>
			<div className={`box filter-box margin-b-20${!toggleFilters ? " hidden" : ""}`}>
				<div className='margin-b-20 flex-row'>
					<label className='flex-row'>
						<input type='checkbox' name='full-filter' defaultChecked={false} onChange={saveFilters} />
						Masquer les créneaux complets
					</label>
					<label className='flex-row'>
						<input type='checkbox' name='disable-filter' defaultChecked={filters.disable} onChange={saveFilters} />
						Désactiver les filtres
					</label>
				</div>
				<div className='margin-b-20'>
					<h4 style={{ textAlign: "left" }}>Filtrer par éducatrice:</h4>
					<div className='flex-row flex-row margin-t-10 by-trainer'>
						<label className='flex-row'>
							<input type='checkbox' name={35} defaultChecked={filters.trainers["35"]} onChange={saveFilters} />
							Chloe
						</label>
						<label className='flex-row'>
							<input type='checkbox' name={34} defaultChecked={filters.trainers["34"]} onChange={saveFilters} />
							Elodie
						</label>

						{cookies.email === "christian.sulecki@gmail.com" && (
							<label className='flex-row'>
								<input type='checkbox' name={1} defaultChecked={filters.trainers["1"]} onChange={saveFilters} />
								Christian
							</label>
						)}
					</div>
				</div>
				<div>
					<h4 style={{ textAlign: "left" }}>Filtrer par activité:</h4>
					<div className='flex-row margin-t-10 by-event'>
						{getUniqueEvents(events)
							.sort()
							.map((event, index) => (
								<label key={index} className='flex-row'>
									<input type='checkbox' name={event} defaultChecked={filters.events[event]} onChange={saveFilters} />
									{event}
								</label>
							))}
					</div>
				</div>
			</div>

			<FullCalendar
				ref={Calendar}
				locale={frLocale}
				height='auto'
				expandRows={true}
				selectable={true}
				plugins={[listPlugin, interactionPlugin]}
				noEventsContent={NoEventRender}
				initialView={"listWeek"}
				events={filterEvents(events)}
				eventContent={eventInfo => renderEventContent(eventInfo, isLoggedIn)}
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
