# Backend architecture — reservations, payments & refunds

This document describes the target architecture for the booking/payment layer, the
critical issues that were found during the August 2026 review, what has already been
fixed, and what remains to do (with a phased plan).

## 1. What was wrong

### Security (critical)

| Issue | Status |
|---|---|
| `GET /api/v1/user` returned **full user rows to anonymous callers**, including bcrypt password hashes and each trainer's **Stripe secret key** | **Fixed** — trainer-only + secrets stripped from every user-returning route |
| The auto-generated CRUD (`@bankall/mysql-backend`) exposed **every table** unauthenticated: `PUT /api/v1/user/:id` (privilege escalation), `PUT /api/v1/user_package/:id` (free credits), `GET /api/v1/sessions/:id` (session hijacking), `payment_activity`, `notification`, … | **Fixed** — ACL middleware in `index.js`: raw table access requires a trainer session (`dog` writes allowed for logged-in users); `sessions` is never reachable |
| `/api/v1/cart/payment/success/:id_trainer/:session_id/:id_user` trusted the `:id_user` URL segment and could be replayed by anyone | **Fixed** — user resolved from `payment_activity`, confirmation is idempotent |
| Cancelling / marking reservations paid had **no ownership check** — any caller could cancel anyone's reservation | **Fixed** — owner-or-trainer check; `paid` flag is trainer-only; the 24h cancellation cutoff is now enforced server-side (was client-side only) |
| `/api/v1/cron/*` (mass mailing, payment reconciliation) was open to anyone | **Fixed** — requires `?token=<CRON_SECRET>` once `CRON_SECRET` is set in `.env` (**update the crontab accordingly**) |
| `GET /api/v1/user_package?id_user=<n>` let any logged-in member read another member's packages (the guard only covered `?id=`) | **Fixed** — non-trainers always get their own packages, whatever the parameter |
| Google Places API key hardcoded in `router/Public/index.js` | **Fixed** — read from `GOOGLE_PLACES_API_KEY` env var |

> **Action required — rotate secrets.** Because `stripe_sk` values and password
> hashes were exposed to any caller, assume they leaked:
> 1. Roll every trainer's Stripe secret key (Stripe dashboard → Developers → API keys).
> 2. Rotate the Google Places key (it is also in git history).
> 3. Consider a password-reset campaign for users.

### Payments (robustness)

| Issue | Status |
|---|---|
| Payment confirmation depended on the user's browser coming back (return URL), with a cron as partial backstop; the two code paths were separate and not idempotent | **Fixed** — return URL and cron now call the same idempotent, server-verified `confirmCheckoutSession` (always validated against the Stripe API, never trusting the caller). A signed webhook endpoint (`POST /api/v1/stripe/webhook/:id_trainer`) also exists but is **optional** — see section 3 |
| **No transactions / atomicity**: package credits were read-then-written (double-spend under concurrency), double-cancel refunded credits twice, slot capacity was never checked at booking time | **Fixed** — `lib/booking.js`: `FOR UPDATE` slot locking, atomic `UPDATE … WHERE usage < number_of_session` credit consumption, idempotent cancellation |
| **Refunds never touched Stripe** — cancelling a Stripe-paid reservation only restored package credits | **Fixed** — automatic partial refund of the checkout session (trainer cancellation: always; user cancellation: only outside the cutoff window). Failures are recorded in `payment_history` with status `refund_failed` for manual follow-up |
| Abandoned checkouts dead-ended: the Checkout session expires after 24h and there was no way to pay afterwards (the "waiting payments" link pointed at the dead session) | **Fixed** — by design (business rule), an unpaid reservation **keeps its seat** in unpaid status; a "Régler" button on `/account/reservations` (`GET /cart/pay-reservation/:id`) reuses the open Checkout session or creates a fresh one. Works for "pay on site" reservations too. Trainers can still cancel or mark paid manually |
| Abandoned checkouts were re-checked against Stripe forever by the cron | **Fixed** — expired sessions get a terminal `payment_history` row (bookkeeping only, reservations untouched) |

### Reported bugs

**Bug 1 — booking more sessions than the package allows threw the whole order away.**
`handleReservation` `return`ed mid-loop on the first exhausted package: remaining items
were silently dropped, the cart was not cleaned, `item_to_pay` went stale (so a later
Stripe payment could confirm the *previous* checkout's items). Root cause: the cart
assigned the same last credit to several items, then the usage check failed at
reservation time.
*Fix:* the cart now decrements a per-package credit counter when assigning payment
types, and at reservation time the atomic credit check **downgrades the item to
"pay on site" with a warning instead of aborting** — everything else in the cart is
processed normally.

**Bug 2 — users "kicked out" of Stripe payment.** Several concrete causes found and fixed:
- `unit_amount: price * 100` produced non-integer amounts for decimal prices → Stripe
  rejected the session (`Math.round` now, and DECIMAL columns are returned as numbers).
- `automatic_tax: enabled` unconditionally → session creation fails on Stripe accounts
  with no tax registration (now enabled only when `vat_applicable`).
- `/stripe-redirect` crashed in its error path (undefined variables) and redirected to
  `undefined` when the session was already completed/expired (`session.url` is null) —
  now redirects sensibly per session status.
- `/stripe-redirect-no-trainer` **hung forever** on any error (empty catch, no response).
- No `cancel_url` — the Checkout page had no way back to the site.
- Session state (`item_to_pay`, `stripe_session_url`) was mutated right before
  redirects without an explicit save (risky with `pm2 -i max`) — now `session.save()`
  is awaited before every redirect.
- A slot deleted while sitting in someone's cart broke the whole cart page
  (`getSlotDetail` referenced an undefined variable in its error path) — invalid items
  are now dropped from the cart instead.
- Double-clicking "pay" created duplicate reservations, then crashed on the empty cart
  — now redirects to the pending Checkout session.

## 2. Target architecture

```
router/            HTTP only: auth/ownership checks, request shaping, responses
  Cart/  Private/  Stripe/ (webhook)  Cron/  Push/ …
lib/
  booking.js       Domain services: reserveSlot, cancelReservation,
                   confirmCheckoutSession, markCheckoutExpired, refunds
  stripe.js        Per-trainer Stripe client cache (+ webhook secret lookup)
  payment-link.js  Signed payment links (HMAC) for unpaid reservations/packages
  notification.js  Trainer activity feed: query, per-trainer ownership, wording
  push.js          Web Push (VAPID) subscriptions and delivery to trainers
  waiting-list.js  Offers of freed spots to the waiting list (rules: waiting-list-rules.js)
  calendar.js      .ics entries for booked sessions
  slot-location.js Where a slot takes place: default, "not known yet", writes
  slot-visibility.js Whether a slot shows in the agenda (slot.is_public)
  db.js            mysql2/promise pool, query(), withTransaction()
@bankall/mysql-backend   Legacy generic CRUD — being phased out, now behind an ACL
```

Principles applied (and to keep applying as code migrates):
- **Every money- or credit-affecting write goes through `lib/booking.js`**, inside a
  transaction, with atomic guards (`affectedRows`) instead of read-then-write.
- **Payment confirmation is one idempotent, server-verified operation**
  (`confirmCheckoutSession`, always re-checked against the Stripe API) with several
  interchangeable triggers: the browser return URL, the reconciliation cron, and —
  where configured — the Stripe webhook. Any subset of triggers yields the same state.
- Refund failures never block a cancellation; they are persisted for manual handling.
- Reservation flow is *reserve first (unpaid) → create Checkout session → confirm via
  webhook*. If payment never happens, the reservation keeps its seat in unpaid status
  and can be paid later from the account (`/cart/pay-reservation/:id`); expired
  sessions are only settled in `payment_history` so the cron stops polling them.

### Payment flow

```
user → GET /cart/checkout/:idTrainer
         ├─ reserveSlot() per item (transaction: capacity + credits)   [warnings, no aborts]
         ├─ stripe.checkout.sessions.create (only "direct" items)
         ├─ payment_activity row (session_id → items)
         └─ redirect to Stripe
user → GET /cart/payment/success/…          → confirmCheckoutSession   [idempotent]
cron → GET /cron/check-missing-payments?token=…  [same, every ~5 min + settle expired]
Stripe → POST /api/v1/stripe/webhook/:id_trainer [same; optional, per trainer]
```

The cron only polls sessions that have no `payment_history` row yet, and expired
sessions get a terminal row, so the polled set stays tiny — running it **every
5 minutes** is cheap and gives near-webhook confirmation latency with zero setup on
the trainers' Stripe accounts.

## 3. Deployment checklist

> **There is only one database**: the dev server and production share it. Any
> migration below run while developing is therefore already live — and conversely,
> local testing writes real data.

### Required

1. `npm install` (dependencies changed, see below) — requires Node ≥ 18 (dev machine
   runs Node 26; note `config@3` did not even load on Node ≥ 23).
2. **`.env` additions**:
   ```
   CRON_SECRET=<random string>            # then append ?token=… to cron URLs
   GOOGLE_PLACES_API_KEY=<rotated key>    # /get-reviews returns [] until set
   CANCELLATION_CUTOFF_HOURS=24           # optional, default 24
   PAYMENT_LINK_SECRET=<random string>    # optional, falls back to SESSION_COOKIE_SECRET
   ```
   `PAYMENT_LINK_SECRET` signs the payment links trainers copy for their clients.
   Rotating it (or `SESSION_COOKIE_SECRET`, the fallback) invalidates links already
   sent out — clients can still pay from their account, so it is not critical.
3. **Crontab**: add `?token=<CRON_SECRET>` to the cron URLs, and schedule
   `/api/v1/cron/check-missing-payments` **every 5 minutes** — it is the primary
   backstop for payment confirmation (users who never come back from Stripe).
4. Rotate the leaked secrets (see section 1).
5. **Short payment links table** (needed by the copy-link buttons) — **already created**
   (there is a single database, shared by dev and production), kept here for reference:
   ```sql
   CREATE TABLE payment_link (
     id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
     code VARCHAR(16) NOT NULL,
     type VARCHAR(32) NOT NULL,
     target_id INT NOT NULL,
     created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
     UNIQUE KEY uniq_payment_link_code (code),
     UNIQUE KEY uniq_payment_link_target (type, target_id)
   );
   ```
   If the table is missing, the copy buttons fall back to the long signed URLs
   instead of failing.
6. **Trainer device notifications (Web Push)** — see section 7. `.env` additions:
   ```
   VAPID_PUBLIC_KEY=<from npx web-push generate-vapid-keys>
   VAPID_PRIVATE_KEY=<idem>
   VAPID_SUBJECT=mailto:contact@wecandogit.com   # optional, this is the default
   ```
   Without those two keys the whole feature is inert (nothing sent, and the UI
   hides itself). Table — **already created** on the database reachable from
   `config/developpment.json`; if production really points at another host
   (`config/production.json` names a different one), run it there too:
   ```sql
   CREATE TABLE push_subscription (
     id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
     id_user INT NOT NULL,
     endpoint VARCHAR(512) NOT NULL,
     p256dh VARCHAR(255) NOT NULL,
     auth VARCHAR(255) NOT NULL,
     user_agent VARCHAR(255) NULL,
     created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
     UNIQUE KEY uniq_push_subscription_endpoint (endpoint),
     KEY idx_push_subscription_user (id_user)
   );
   ```
   Rotating the VAPID keys invalidates every stored subscription (each trainer
   has to press "Activer" again), so keep them alongside the other secrets.
7. **Per-member "pay in person" permission** (section 7) — required for the trainer
   checkbox on a member's profile to work. Until it is run, the code behaves as
   before (everybody may pay in person) and the checkbox cannot be saved:
   ```sql
   ALTER TABLE user ADD COLUMN can_pay_later TINYINT(1) NOT NULL DEFAULT 1;
   ```
8. Recommended indexes:
   ```sql
   CREATE INDEX idx_reservation_slot_enabled ON reservation (id_slot, enabled);
   CREATE INDEX idx_payment_activity_session ON payment_activity (session_id);
   CREATE INDEX idx_payment_history_session ON payment_history (session_id);
   CREATE INDEX idx_waiting_list_slot ON waiting_list (id_slot, proposed, declined);
   ```
9. **Waiting list** (section 8) — schedule `/api/v1/cron/process-waiting-lists?token=…`
   **every minute**: it sends the follow-up offers, so its period is how late past
   the 15-minute window the next person can be told. With nothing to offer it is
   one query. No migration (it uses the existing `proposed` / `proposed_at`
   columns). Optional `.env`: `WAITING_LIST_OFFER_MINUTES=15`.
10. **Slot location** (section 8) — **already run** on the database reachable from
    `config/developpment.json`; run it on any other host. Until then the code simply
    carries no location. No column default: slots created before it have no location,
    and the default address only comes from the creation form:
    ```sql
    ALTER TABLE slot ADD COLUMN location VARCHAR(255) NULL;
    ```
11. **Slot visibility** (section 8) — **already run** on the same database (every
    existing slot stays visible); run it on any other host. Until then every slot
    counts as public, as before:
    ```sql
    ALTER TABLE slot ADD COLUMN is_public TINYINT(1) NOT NULL DEFAULT 1;
    ```

### Optional — Stripe webhooks (per trainer)

Not required for correctness: the return URL + 5-minute cron already confirm every
payment (both server-verified and idempotent). A webhook adds seconds-level
confirmation latency, and is the only channel for events we would otherwise never
see — refunds made directly in the Stripe dashboard, disputes, and async payment
methods (SEPA/bank transfer) if ever enabled. Enable it per trainer, whenever wanted:

1. One-time DB migration (the code tolerates the column's absence):
   ```sql
   ALTER TABLE user ADD COLUMN stripe_whsec VARCHAR(255) NULL;
   ```
2. In that trainer's Stripe dashboard (Developers → Webhooks → Add endpoint):
   - URL: `https://<domain>/api/v1/stripe/webhook/<trainer user id>`
   - Events: `checkout.session.completed`, `checkout.session.expired`,
     `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`
   - Store the signing secret (`whsec_…`) in that trainer's `user.stripe_whsec`.

Until a trainer's `stripe_whsec` is set, their webhook endpoint simply rejects calls
and everything flows through return URL + cron. Remember the signing secret must be
re-provisioned if the webhook endpoint is recreated.

## 4. Trainer notifications

The `notification` table is the trainers' activity feed (bookings, cancellations,
waiting-list entries, package purchases), written by `backend.notify()` and read
on `/account/notifications`.

**Ownership.** A notification has no `id_trainer` column: the trainer it concerns
is derived from the slot or the package the event is about (`slot.id_trainer` /
`package.id_trainer`). `lib/notification.js` computes that column, and owns both
the feed query and the wording of an event, so the dashboard label and the push
notification body can never drift apart.

**Scoping.** `GET /notification` returns the calling trainer's own notifications;
`?all=1` returns the association-wide feed. The dashboard shows both as a
"Les miennes" / "Toutes" switch. Events on rows owned by an account that is not
`is_trainer = 1` (there are legacy slots owned by user 36, and one owned by user
0) only appear under "Toutes" and are pushed to nobody.

**Device notifications (Web Push).** `lib/push.js` + `router/Push`:

```
trainer presses "Activer"  → sw.js registered, Notification permission asked
                           → pushManager.subscribe(VAPID public key)
                           → POST /push/subscribe   (one row per device)
booking happens            → backend.notify() inserts the row
                           → pushNotificationToTrainer() resolves the owner
                           → web-push to each of that trainer's devices
```

- One `push_subscription` row per browser/device, keyed by its unique `endpoint`,
  so each trainer enables it once per phone/computer. Re-subscribing updates the
  row instead of duplicating it.
- A push service answering **404/410** means the subscription is dead (browser
  data cleared, notifications revoked): the row is deleted on the spot, so the
  table never accumulates stale endpoints.
- Sending is **fire-and-forget** from `backend.notify()`: contacting FCM/Mozilla
  must never slow down or fail a booking.
- `POST /push/test` sends a test notification to the caller's own devices —
  the only practical way to tell a trainer's "it doesn't work" from a silent
  platform problem.
- `public/sw.js` has **no `fetch` handler and caches nothing**, on purpose:
  registering it cannot make assets go stale. It only shows notifications and
  focuses an existing tab on click.
- **iOS requires the site to be installed** to the Home Screen (iOS 16.4+) before
  Web Push works at all. The UI detects Safari-on-iOS outside standalone mode and
  shows the "Partager → Sur l'écran d'accueil" instruction instead of a button
  that could not work. Android and desktop Chrome/Firefox/Edge work as-is.
- HTTPS is required (localhost excepted), which production already is.
- Opening `/account/notifications` re-sends the subscription the browser holds
  (idempotent upsert), so a subscription the server pruned or the browser renewed
  heals itself without the trainer doing anything. The service worker does **not**
  handle `pushsubscriptionchange` (Safari does not fire it, and the worker has no
  way to know the API origin in development): in the rare case a browser rotates
  a subscription and the trainer never reopens that page, notifications stop until
  they press "Activer" again — the switch shows the real state.

## 5. Dependencies

Updated now: `stripe` 16→22, `config` 3→5 (3.x is broken on Node ≥ 23), `nodemailer`
6→7, `dotenv` 16→17, `bcrypt` 5→6, `axios`/`cors`/`express-session`/
`express-mysql-session` to latest, added `mysql2`. Removed unused `argon2`,
`@auth/express`, and `body-parser` (Express built-ins used instead).

Deliberately deferred:
- **Express 4.22 → 5**: breaking route-syntax changes (`/:id?` optional params become
  `{/:id}`), which touch every router and the auto-CRUD package. Do it as its own PR.
- `md5` is still used for password-reset tokens — replace with random single-use,
  expiring tokens (`crypto.randomBytes`) stored server-side (phase 2).

## 6. Roadmap

**Phase 2 — retire the generic CRUD (in progress direction: mysql2 + repositories)**
- Move the remaining raw `backend.get/post/put/handleQuery` calls into explicit
  repository modules on `lib/db.js`; delete the auto-mounted table endpoints and the
  ACL that guards them; give the trainer dashboard purposeful endpoints instead of
  raw table writes.
- Replace the `/fake-user` impersonation and `optout/:email` routes with signed,
  audited equivalents.
- Proper auth: single role model from the session only (drop the `is_trainer` cookie),
  password-reset tokens as above, login rate limiting.
- Encrypt trainer Stripe keys at rest (or move to per-trainer env entries).

**Phase 3 — quality**
- Request validation (zod) at router boundaries; Express 5; structured logging (pino)
  instead of `console.log` (the error handler currently logs full session contents —
  trim that); integration tests for `lib/booking.js` (the review's ad-hoc test
  scenarios — capacity race, double-cancel, credit exhaustion — are the seed of that
  suite); CI running lint + tests.
- Frontend deps (vite 5→7, eslint 9 flat config, react-router 6→7) as a separate task.

## 7. Behavioral notes / policies

- **Unpaid reservations hold their seat** (explicit business rule): abandoning or
  failing an online payment never cancels the booking. The user pays later via the
  "Régler" button on their reservations page; the trainer sees the unpaid badge on the
  slot and can cancel or mark it paid in person. Consequence: a slot can fill up with
  unpaid bookings — releasing seats is a deliberate, manual trainer decision.
- **Paying in person is a per-member permission.** Booking a slot offers "Payer en
  personne" (`payment_type = 'later'`, settled with the trainer), and some members
  used it session after session without ever settling. A trainer can therefore take
  the option away from one member, from their profile
  (`/account/user/edit/:id` → "Autoriser le paiement en personne", stored in
  `user.can_pay_later`, granted by default). That member can then only pay online or
  spend a package credit: the option disappears from their cart, `PUT /cart/:item/…`
  refuses it if asked for anyway, a `later` left in an older cart is dropped, and an
  exhausted package credit downgrades their booking to an online payment instead of a
  session to pay on site (`reserveSlot`'s `downgrade_payment_type`). `canPayLater()`
  in `lib/booking.js` is the single source of that answer. The restriction is about
  *booking*: a trainer still marks any session paid in person afterwards, which is
  what `payment_type = 'later'` also means on an already-settled reservation.
  A member cannot lift their own restriction: `PUT /update-user` (no `:id`) now only
  writes a whitelist of self-editable fields — which also closes the older hole of a
  member granting themselves `is_trainer`.
- **Paying afterwards.** `/account/waiting_payments` lists everything a member still
  owes: unpaid reservations and unpaid packages (whatever the reason — "pay on site" or
  an online payment that never went through), each with its amount and its own
  "Payer en ligne" link, plus any
  online attempt of the last 24h whose Checkout session is still open (resumable via
  its Stripe link). The list is capped at 3 months of history
  (`UNPAID_HISTORY_MONTHS`) — older unpaid items are mostly sessions settled in person
  and never ticked off, and would bury the ones that matter (one member had 200 of
  them). Everything upcoming is always listed, however far ahead; trainers still see
  and can bill older ones from `/account/past-slots`. `GET /cart/pay-reservation/:id` and `GET /cart/pay-package/:id`
  reuse the open session if there is one, otherwise create a fresh single-item one;
  both accept past slots (a session is often settled after the fact) and refuse
  anything already paid or cancelled.
  **Only what is really still owed is listed.** A reservation whose *slot* the trainer
  deleted is never listed (nor payable): deleting a slot cancels its reservations
  today, but deletions from before that left them `enabled = 1`, and members kept
  being asked to pay for sessions that no longer existed — so the listing and
  `/cart/pay-reservation/:id` both check `slot.enabled`, as `/reservation` already
  did. An unfinished online attempt is only offered while **all** of the items its
  Checkout session covers are still unpaid and active: resuming a session charges its
  original total, so once one item is gone the attempt is dropped and the remaining
  items are paid one by one from their own links.
  Trainers can copy those links from `/account/slots`, `/account/past-slots` and
  `/account/users/user-package/:id_user` and send them to a client. A copied link
  carries an HMAC signature over its (type, id) so it works **without a session** —
  it only ever allows paying that one item, never reading or changing anything, and
  stays valid until the item is paid. Links shown to a member in their own account are
  unsigned (their session authorises them), which keeps signatures off the pages that
  don't need them.
- **Short links.** A signed URL is not something you paste into a text message, so the
  copied form is `<domain>/p/<code>` (`payment_link` table, `lib/payment-link.js`).
  The code is a 10-character random string acting as the secret, created once per item
  and reused, so re-sending the link later gives the same URL. `GET /p/:code` resolves
  it and redirects to the signed payment URL; an unknown code lands on the account
  page. Listings build every code they need in one round trip (one `INSERT IGNORE` +
  one `SELECT`), so a page of unpaid reservations is still two queries.
- **Refund policy** (configurable via `CANCELLATION_CUTOFF_HOURS`): trainer
  cancellation always gives package credits back, and refunds a Stripe payment only if
  the trainer says so — cancelling a reservation paid online from `/account/slots`
  asks "Annuler et rembourser" / "Annuler sans rembourser" (`PUT /reservation/:id`
  with `refund: false` keeps the payment; absent means refund, which is also what
  deleting a whole slot still does). User cancellation restores credits and refunds
  Stripe payments only when the slot is more than the cutoff away. Users cannot cancel
  at all inside the cutoff (server-enforced).
- Refund amount is the activity price of the cancelled session (partial refund of the
  Checkout payment). With `automatic_tax` enabled the collected total can exceed the
  base price — review whether tax should be included in refunds for VAT trainers.
- A Stripe-paid **package** purchase (`user_package`) is currently not auto-refunded on
  any flow (packages have no cancellation UI); trainers handle those manually from the
  Stripe dashboard.
- Legacy data: some old reservations have inconsistent payment fields (e.g.
  `payment_type='later'` with `paid=1` and a `cs_…` session id) from the pre-webhook
  flow; the refund logic only trusts `payment_type='direct'` + `cs_…` details.

## 8. Waiting list and calendar entries

**Waiting list.** Members join the list of a full slot from the agenda. When a spot
frees up, the people in line are told one after the other, first registered first:

```
reservation cancelled  → offerFreedSpots(slot)          [immediate, fire-and-forget]
cron, every minute     → processWaitingLists()          [follow-ups + any other freed spot]
  per slot with a free spot and people in line (slot row locked FOR UPDATE):
    offers to send = free spots − offers sent < 15 min ago
    next member(s) in line → proposed = 1, proposed_at = NOW()  (off the list)
    mail "Une place s'est libérée … cliquez ici pour la réserver"
```

- State lives in `waiting_list` only (nothing scheduled in memory, which several pm2
  processes and restarts would break). `proposed = 1` means "told, and off the list":
  the agenda lets that member join the list again if the slot fills up again.
- **An offer never holds the spot**: whoever books first gets it. If it is still free
  after the window (`WAITING_LIST_OFFER_MINUTES`, 15), the next person is told; two
  freed spots mean two people at a time. A member registered twice is told once.
- A failed mail is not retried — the member is already off the list, and the next
  one is told when the window runs out.
- The link (`/cart/liste-attente/:id_waiting_list`) carries no secret on purpose: all
  it does is offer a public slot for booking. It asks to log in first (`/login?next=`),
  then `POST /cart/waiting-list/:id` puts that one slot in a **second session cart**
  (`waiting_list_cart`). Every cart route takes `?source=waiting-list` to work on it,
  so the member picks a dog and a payment method as usual, and the regular cart they
  may have pending is neither shown, booked nor emptied. If someone was quicker the
  page says so and offers to rejoin the list; `reserveSlot` re-checks capacity at
  checkout anyway.
- Trainers see each member's status on `/account/slots`: "Sur la liste" or "Place
  proposée le …".

**Calendar entries.** The booking confirmation mail carries one `.ics` attachment per
session whose place is known (`METHOD:PUBLISH`, one event each — the form every
calendar app imports). Gmail also reads them and shows its own "add to calendar" card
per session, so no separate Google Calendar link is needed. A session without a place
gets no entry in the confirmation: it comes with the "lieu ajouté" mail, which is
the usual path (no place → a place) and avoids a duplicate. Slot dates are stored as
Paris wall-clock time while the database clock runs in UTC, so `lib/calendar.js`
converts Europe/Paris → UTC (DST-aware) before writing events. The UID is
`reservation-<id>@wecandogit.com`. Cancelling does not send a calendar cancellation.

Plain entries, not invitations, on purpose (tested on Gmail, 2026-11-12): Google
Calendar adds a *new* event for every plain `.ics`, even with the same UID and a higher
`SEQUENCE`, so a changed place leaves a duplicate there (Apple/Outlook may update in
place). Invitations (`METHOD:REQUEST` + organizer) do update in place on Google, even
unopened, but each one carries a single event (Gmail showed 1 of 5 in a 5-session
confirmation), first-time senders get a "this event isn't in your calendar yet"
banner, and they show RSVP buttons. Places rarely change, so members read the new
place in the mail.

**Slot location.** `slot.location` says where a session takes place. The creation form
is pre-filled with the park (`We Can Dog It, Les Sables, 51370 Les Mesneux`) — the
only source of that default: the column has none, and slots created before it existed
have no location. Emptying the field means "not known yet" (NULL). It is written with
raw SQL (`saveSlotLocation`), never through the generic CRUD, which would store an
emptied field as `""` or a null as the string `"null"`. The location goes into the
calendar entries, and each agenda slot that has one shows a directions button: Apple
Maps on iPhone/iPad, a `geo:` link on Android (the phone offers the user's own
navigation app), Google Maps directions from the current position on desktop
(`src/utils/navigation.js`).

**Address autocomplete.** The slot forms' "Lieu" field suggests addresses as the
trainer types (`src/components/AddressAutocompleteField.jsx`, Places API (New)
`AutocompleteSuggestion`, France only, biased towards Les Mesneux). Free text still
works, and without `VITE_GOOGLE_MAPS_API_KEY` (frontend `.env.*`) the field is a plain
text field. Only the suggestion text is used — no Place Details call — so each request
is one "Autocomplete Requests" event: 10,000 free per month, then $2.83 per 1,000.
Requests wait for a 300 ms pause in typing and 3 characters, so typing an address costs
a handful of them. It is a browser key: restrict it to the site's referrers and to
"Maps JavaScript API" + "Places API (New)", and cap the daily quota.

**Location changes.** When a trainer edits an upcoming slot and its place is set or
changed, every member with an active reservation on it gets one mail ("Le lieu de
votre séance a été ajouté" / "Changement de lieu pour votre séance", with the old place
when it changed), listing all of their dogs on that slot, and a `.ics` per reservation
with the new place (same UID as the booking's, higher `SEQUENCE`: Apple/Outlook may
update the entry, Google Calendar adds a second one — see "Calendar entries"). Saving
the form unchanged, clearing the place, past or deleted slots,
and user 2 (placeholder owner of trainer-registered dogs) send nothing. Sent
fire-and-forget from `PUT /slot/:id` (`lib/location-change.js`); the location write is
restricted to the trainer's own slot.

**Hidden slots.** "Visible dans l'agenda" (`slot.is_public`, ticked by default) on the
slot forms. A hidden slot exists for its trainer only: it is listed in their dashboard
(marked "Masqué de l'agenda") and they can register dogs on it, but members cannot see
it (agenda, "next slots" listings), add it to a cart, book it (`reserveSlot` refuses it,
so an old cart or a crafted request cannot either), nor be offered it from a waiting
list. Trainer registrations do not go through `reserveSlot`, which is why they still
work. "Publier les N créneaux masqués dans l'agenda" on `/account/slots`
(`POST /publish-hidden-slots`) makes all of the calling trainer's upcoming hidden slots
visible at once.
