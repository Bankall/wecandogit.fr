/*
 * Loads the Google Maps JavaScript API once, only when an address field needs it,
 * and returns its "places" library. Rejects when no key is configured
 * (VITE_GOOGLE_MAPS_API_KEY), so callers fall back to a plain text field.
 *
 * Loading the library alone is not billed (no map is displayed); only autocomplete
 * requests are.
 */
let placesPromise = null;

const loadPlacesLibrary = () => {
	if (placesPromise) {
		return placesPromise;
	}

	const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
	if (!key) {
		return Promise.reject(new Error("VITE_GOOGLE_MAPS_API_KEY is not set"));
	}

	placesPromise = new Promise((resolve, reject) => {
		const callbackName = "__wcdiGoogleMapsLoaded";
		window[callbackName] = () => {
			delete window[callbackName];
			window.google.maps.importLibrary("places").then(resolve, reject);
		};

		const params = new URLSearchParams({ key, v: "weekly", loading: "async", language: "fr", region: "FR", callback: callbackName });
		const script = document.createElement("script");
		script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
		script.async = true;
		script.onerror = () => reject(new Error("Google Maps could not be loaded"));
		document.head.appendChild(script);
	}).catch(err => {
		// Lets a later field retry (network hiccup) instead of caching the failure
		placesPromise = null;
		throw err;
	});

	return placesPromise;
};

export { loadPlacesLibrary };
