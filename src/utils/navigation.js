/*
 * Link opening the visitor's navigation app with directions to `address`, from
 * where they are now:
 * - iPhone / iPad: Apple Maps (iPadOS reports itself as a Mac, hence the touch check)
 * - Android: a geo: link, which lets the phone hand it to the user's own navigation
 *   app (Google Maps, Waze…)
 * - anything else (desktop): Google Maps directions in a new tab
 */
const isAppleMobile = ({ userAgent, maxTouchPoints }) => /iPad|iPhone|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);

const getNavigationLink = (address, device = typeof navigator !== "undefined" ? navigator : { userAgent: "", maxTouchPoints: 0 }) => {
	const destination = encodeURIComponent(address);
	const userAgent = device.userAgent || "";

	if (isAppleMobile({ userAgent, maxTouchPoints: device.maxTouchPoints || 0 })) {
		return { href: `https://maps.apple.com/?daddr=${destination}&dirflg=d`, newTab: false };
	}

	if (/Android/i.test(userAgent)) {
		return { href: `geo:0,0?q=${destination}`, newTab: false };
	}

	return { href: `https://www.google.com/maps/dir/?api=1&destination=${destination}`, newTab: true };
};

export { getNavigationLink };
