import { useState, useEffect } from "react";
import axios from "axios";

export function useFetch(options, callback) {
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(null);
	const [data, setData] = useState(null);

	const url = typeof options === "string" ? options : options.url;
	useEffect(() => {
		const controller = new AbortController();

		setLoading(true);

		axios({ url, method: options.data ? "post" : "get", data: options.data, headers: options.headers, signal: controller.signal })
			.then(response => {
				setError(null);
				setData(response.data);
				setLoading(false);

				if (typeof callback === "function") {
					callback(response.data);
				}
			})
			.catch(error => {
				if (error.code === "ERR_CANCELED") {
					// no need to handle this error caused by unmounted component
					return;
				}

				setError(error.message);
				setLoading(false);
			});

		return () => controller.abort();
	}, [url]);

	return { loading, error, data };
}
