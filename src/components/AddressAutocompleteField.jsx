/*
 * Address field with Google Places autocomplete (Places API (New), programmatic
 * AutocompleteSuggestion, so the field keeps the site's own styling and stays a
 * plain Formik text field).
 *
 * - Free text always works: a suggestion is a convenience, never a requirement.
 * - Without VITE_GOOGLE_MAPS_API_KEY, or if Google cannot be loaded, it is just a
 *   text field.
 * - Cost: only the suggestion text is used (no Place Details call), so every request
 *   is billed as one "Autocomplete Request" (10,000 free per month). Requests wait
 *   for a pause in typing (DEBOUNCE_MS) and need MIN_CHARS characters, which keeps
 *   that to a handful per address typed.
 */
import { useEffect, useRef, useState } from "react";
import { useField } from "formik";
import { loadPlacesLibrary } from "../utils/google-places";
import "./AddressAutocompleteField.css";

const DEBOUNCE_MS = 300;
const MIN_CHARS = 3;
// Biases suggestions towards the association's area (Les Mesneux), without excluding the rest
const BIAS_CENTER = { lat: 49.2235, lng: 3.9606 };
const BIAS_RADIUS_METERS = 50000;

export function AddressAutocompleteField({ name, placeholder, maxLength }) {
	const [field, , helpers] = useField(name);
	const [suggestions, setSuggestions] = useState([]);
	const [highlighted, setHighlighted] = useState(-1);
	const [open, setOpen] = useState(false);
	const placesRef = useRef(null);
	const sessionRef = useRef(null);
	const timerRef = useRef(null);
	// Ignores answers to an older keystroke arriving after a newer one
	const requestIdRef = useRef(0);

	useEffect(() => {
		let cancelled = false;

		loadPlacesLibrary()
			.then(places => {
				if (!cancelled) {
					placesRef.current = places;
				}
			})
			.catch(() => {
				// No key, or Google unreachable: the field stays a plain text field
			});

		return () => {
			cancelled = true;
			clearTimeout(timerRef.current);
		};
	}, []);

	const fetchSuggestions = input => {
		const places = placesRef.current;
		clearTimeout(timerRef.current);

		if (!places || input.trim().length < MIN_CHARS) {
			setSuggestions([]);
			return;
		}

		timerRef.current = setTimeout(async () => {
			const requestId = ++requestIdRef.current;

			try {
				// One session per address typed, renewed once a suggestion is picked
				if (!sessionRef.current) {
					sessionRef.current = new places.AutocompleteSessionToken();
				}

				const { suggestions: results } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
					input,
					sessionToken: sessionRef.current,
					language: "fr",
					region: "fr",
					includedRegionCodes: ["fr"],
					locationBias: { center: BIAS_CENTER, radius: BIAS_RADIUS_METERS }
				});

				if (requestId !== requestIdRef.current) {
					return;
				}

				setSuggestions((results || []).map(result => result.placePrediction?.text?.toString()).filter(Boolean));
				setHighlighted(-1);
				setOpen(true);
			} catch (err) {
				console.error("Places autocomplete failed", err);
				setSuggestions([]);
			}
		}, DEBOUNCE_MS);
	};

	const pick = text => {
		helpers.setValue(text);
		setSuggestions([]);
		setOpen(false);
		sessionRef.current = null;
	};

	return (
		<div className='address-autocomplete'>
			<input
				{...field}
				id={name}
				type='text'
				autoComplete='off'
				placeholder={placeholder}
				maxLength={maxLength}
				role='combobox'
				aria-expanded={open && suggestions.length > 0}
				aria-autocomplete='list'
				onChange={event => {
					field.onChange(event);
					fetchSuggestions(event.target.value);
				}}
				onFocus={() => setOpen(true)}
				onBlur={event => {
					field.onBlur(event);
					// Lets a click on a suggestion land before the list closes
					setTimeout(() => setOpen(false), 150);
				}}
				onKeyDown={event => {
					if (!open || !suggestions.length) {
						return;
					}

					if (event.key === "ArrowDown") {
						event.preventDefault();
						setHighlighted(index => Math.min(index + 1, suggestions.length - 1));
					}

					if (event.key === "ArrowUp") {
						event.preventDefault();
						setHighlighted(index => Math.max(index - 1, 0));
					}

					if (event.key === "Enter" && highlighted >= 0) {
						// Picks the suggestion instead of submitting the form
						event.preventDefault();
						pick(suggestions[highlighted]);
					}

					if (event.key === "Escape") {
						setOpen(false);
					}
				}}
			/>

			{open && suggestions.length > 0 && (
				<ul className='address-autocomplete-list' role='listbox'>
					{suggestions.map((suggestion, index) => (
						<li
							key={suggestion}
							role='option'
							aria-selected={index === highlighted}
							className={index === highlighted ? "highlighted" : ""}
							onMouseDown={event => {
								event.preventDefault();
								pick(suggestion);
							}}>
							{suggestion}
						</li>
					))}
					<li className='address-autocomplete-attribution' aria-hidden='true'>
						Suggestions Google
					</li>
				</ul>
			)}
		</div>
	);
}
