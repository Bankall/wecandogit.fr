/*
 * Service worker used only to receive Web Push notifications for trainers.
 *
 * It deliberately has no `fetch` handler and caches nothing: the site keeps
 * being served straight from the network, so registering this worker cannot
 * make assets go stale.
 */

self.addEventListener("install", () => {
	self.skipWaiting();
});

self.addEventListener("activate", event => {
	event.waitUntil(self.clients.claim());
});

self.addEventListener("push", event => {
	let payload = {};

	try {
		payload = event.data ? event.data.json() : {};
	} catch (err) {
		payload = { body: event.data ? event.data.text() : "" };
	}

	const title = payload.title || "We Can Dog It";

	event.waitUntil(
		self.registration.showNotification(title, {
			body: payload.body || "",
			icon: "/logo.png",
			badge: "/logo.png",
			// Same tag replaces an earlier notification about the same subject
			// instead of piling up entries on the device.
			tag: payload.tag || "wecandogit",
			renotify: true,
			data: { url: payload.url || "/account/notifications" }
		})
	);
});

/*
 * Focus an already open tab of the site when possible, rather than opening yet
 * another one.
 */
self.addEventListener("notificationclick", event => {
	event.notification.close();

	const target = event.notification.data?.url || "/account/notifications";

	event.waitUntil(
		(async () => {
			const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });

			for (const client of clientList) {
				if (new URL(client.url).origin === self.location.origin && "focus" in client) {
					await client.focus();

					if ("navigate" in client) {
						await client.navigate(target);
					}

					return;
				}
			}

			await self.clients.openWindow(target);
		})()
	);
});
