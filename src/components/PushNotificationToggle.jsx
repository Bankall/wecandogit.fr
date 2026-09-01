import { usePushNotifications } from "../hooks/usePushNotifications";

/*
 * Lets a trainer turn on device notifications for the slots and packages they
 * own. The subscription is per device, so the wording is about "this device"
 * and the button has to be pressed once per phone/computer.
 */
export default function PushNotificationToggle() {
	const { supported, needsInstall, enabled, loading, subscribed, busy, error, message, subscribe, unsubscribe, sendTest } = usePushNotifications();

	if (loading || !enabled) {
		return null;
	}

	return (
		<div className='push-toggle margin-b-20'>
			<div className='flex-row no-wrap'>
				<span className='flex-grow'>
					<i className={`fa-solid ${subscribed ? "fa-bell" : "fa-bell-slash"}`} aria-hidden='true' />
					&nbsp;
					{subscribed ? "Notifications activées sur cet appareil" : "Recevoir les notifications sur cet appareil"}
				</span>

				{!supported ?
					<span className='push-hint'>Ce navigateur ne gère pas les notifications</span>
				: needsInstall ?
					<span className='push-hint'>Sur iPhone/iPad : ouvre le menu Partager puis « Sur l'écran d'accueil », et réessaye depuis l'icône installée</span>
				:	<span className='flex-row no-wrap'>
						{subscribed && (
							<button className='smallest' disabled={busy} onClick={sendTest}>
								Tester
							</button>
						)}

						<button className='small' disabled={busy} onClick={subscribed ? unsubscribe : subscribe}>
							{busy ?
								"…"
							: subscribed ?
								"Désactiver"
							:	"Activer"}
						</button>
					</span>
				}
			</div>

			{error ?
				<div className='push-message unpaid'>{error}</div>
			:	null}
			{message ?
				<div className='push-message paid'>{message}</div>
			:	null}
		</div>
	);
}
