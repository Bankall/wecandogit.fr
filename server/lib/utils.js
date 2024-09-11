const validateEmail = email => {
	const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

	if (!email || email.length > 254) return false;
	if (!emailRegex.test(email)) return false;

	const parts = email.split("@");
	if (parts[0].length > 64) return false;

	const domainParts = parts[1].split(".");
	if (domainParts.some(part => part.length > 63)) return false;

	return true;
};

const shuffle = array => {
	const shuffled = [...array];
	let currentIndex = shuffled.length;

	// While there remain elements to shuffle...
	while (currentIndex != 0) {
		// Pick a remaining element...
		let randomIndex = Math.floor(Math.random() * currentIndex);
		currentIndex--;

		// And swap it with the current element.
		[shuffled[currentIndex], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[currentIndex]];
	}

	return shuffled;
};

const assert = (...args) => {
	for (const value of args) {
		if (typeof value === "undefined") {
			return false;
		}
	}

	return true;
};

const errorHandler = ({ req, res, err }) => {
	if (!req) {
		req = { originalUrl: "No request" };
	}

	console.log(
		`=============================\n
		At: ${req.originalUrl}
		${req.query ? `With query: ${JSON.stringify(req.query)}\n` : ""}${req.params ? `With params: ${JSON.stringify(req.params)}\n` : ""}${req.body ? `With body: ${JSON.stringify(req.body)}\n` : ""}
		\n\n`,
		err,
		"\n\n============================="
	);

	if (res) {
		res.send({
			error: err.message || err.error || "Une erreur est survenue"
		});
	}
};

export { validateEmail, shuffle, assert, errorHandler };
