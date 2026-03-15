import { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";

const getParams = options => {
	const { data, headers, url, withCredentials } = options;
	const params = {
		url: typeof options === "string" ? options : url,
		method: data ? "post" : "get",
		data,
		headers
	};

	if (withCredentials) {
		params.withCredentials = !!withCredentials;
	}

	return params;
};

export function useFetch(options, callback) {
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(false);
	const [data, setData] = useState(false);
	const [rnd, setRnd] = useState(0);
	const [first, setFirst] = useState(true);

	const params = useMemo(() => getParams(options), [options]);
	const { event, interval } = options;

	const { pathname } = useLocation();

	const handleCallback = useCallback(data => {
		if (typeof callback === "function") {
			callback(data);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		const controller = new AbortController();
		params.signal = controller.signal;

		if (first) {
			setLoading(true);
		}

		setFirst(false);
		axios(params)
			.then(response => {
				setError(null);
				setData(response.data);
				setLoading(false);
				handleCallback(response.data);
			})
			.catch(err => {
				if (err.code === "ERR_CANCELED") {
					// no need to handle this error caused by unmounted component
					return;
				}

				const error = err.response?.data?.error;
				if (error === "not-logged-in") {
					return (window.location.href = `/login#${pathname}`);
				}

				setError(error || "An error occurred");
				setLoading(false);
			});

		return () => controller.abort();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [rnd, params.url]);

	useEffect(() => {
		let refreshInterval;
		const refresh = () => {
			setRnd(Math.random());
		};

		if (event) {
			const events = typeof event === "string" ? [event] : event;
			events.forEach(event => window.addEventListener(event, refresh));
		}

		if (interval) {
			refreshInterval = setInterval(refresh, interval * 1000);
		}

		return () => {
			if (event) {
				const events = typeof event === "string" ? [event] : event;
				events.forEach(event => window.removeEventListener(event, refresh));
			}
			if (refreshInterval) {
				clearInterval(refreshInterval);
			}
		};
	}, [event, interval]);

	return { loading, error, data };
}
