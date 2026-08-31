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
  Cart/  Private/  Stripe/ (webhook)  Cron/ …
lib/
  booking.js       Domain services: reserveSlot, cancelReservation,
                   confirmCheckoutSession, markCheckoutExpired, refunds
  stripe.js        Per-trainer Stripe client cache (+ webhook secret lookup)
  payment-link.js  Signed payment links (HMAC) for unpaid reservations/packages
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
6. Recommended indexes:
   ```sql
   CREATE INDEX idx_reservation_slot_enabled ON reservation (id_slot, enabled);
   CREATE INDEX idx_payment_activity_session ON payment_activity (session_id);
   CREATE INDEX idx_payment_history_session ON payment_history (session_id);
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

## 4. Dependencies

Updated now: `stripe` 16→22, `config` 3→5 (3.x is broken on Node ≥ 23), `nodemailer`
6→7, `dotenv` 16→17, `bcrypt` 5→6, `axios`/`cors`/`express-session`/
`express-mysql-session` to latest, added `mysql2`. Removed unused `argon2`,
`@auth/express`, and `body-parser` (Express built-ins used instead).

Deliberately deferred:
- **Express 4.22 → 5**: breaking route-syntax changes (`/:id?` optional params become
  `{/:id}`), which touch every router and the auto-CRUD package. Do it as its own PR.
- `md5` is still used for password-reset tokens — replace with random single-use,
  expiring tokens (`crypto.randomBytes`) stored server-side (phase 2).

## 5. Roadmap

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

## 6. Behavioral notes / policies

- **Unpaid reservations hold their seat** (explicit business rule): abandoning or
  failing an online payment never cancels the booking. The user pays later via the
  "Régler" button on their reservations page; the trainer sees the unpaid badge on the
  slot and can cancel or mark it paid in person. Consequence: a slot can fill up with
  unpaid bookings — releasing seats is a deliberate, manual trainer decision.
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
  cancellation refunds Stripe payments and package credits unconditionally; user
  cancellation restores credits and refunds Stripe payments only when the slot is more
  than the cutoff away. Users cannot cancel at all inside the cutoff (server-enforced).
- Refund amount is the activity price of the cancelled session (partial refund of the
  Checkout payment). With `automatic_tax` enabled the collected total can exceed the
  base price — review whether tax should be included in refunds for VAT trainers.
- A Stripe-paid **package** purchase (`user_package`) is currently not auto-refunded on
  any flow (packages have no cancellation UI); trainers handle those manually from the
  Stripe dashboard.
- Legacy data: some old reservations have inconsistent payment fields (e.g.
  `payment_type='later'` with `paid=1` and a `cs_…` session id) from the pre-webhook
  flow; the refund logic only trusts `payment_type='direct'` + `cs_…` details.
