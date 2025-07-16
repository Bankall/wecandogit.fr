const encode = str =>
	encodeURIComponent(str || "")
		.replace(/%20/g, "+")
		.replace(/\//g, "%2F");
const decode = str => decodeURIComponent(str || "").replace(/\+/g, " ");

export { encode, decode };
