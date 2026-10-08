# TrialDesk: trial-class booking

Parents in the US, UK and Ireland book a free 1:1 trial class. A free mentor in India is assigned at once (at most **2 trials per mentor per India date**). Every time is shown correctly in each person's own zone, including across Daylight Saving Time changes. When a time is taken, parents get the nearest good alternatives instead of a dead end.

Built for the Codeyoung Senior Full Stack Engineer assignment. "TrialDesk" is a placeholder brand.

<img src="docs/screenshots/01-landing.png" alt="TrialDesk home page" width="100%">

<sub>More screens: [Screenshots](#screenshots).</sub>

|                        |                                                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| Product spec           | [`docs/PRD.md`](docs/PRD.md)                                                                               |
| Technical design       | [`docs/TECHNICAL_DESIGN.md`](docs/TECHNICAL_DESIGN.md)                                                     |
| API reference          | [`docs/API.md`](docs/API.md)                                                                               |                                    |
| AI transcript          | [`TRANSCRIPT.md`](TRANSCRIPT.md)                                                                           |
| Screenshots            | [Screenshots](#screenshots) ([`docs/screenshots/`](docs/screenshots/))                                     |

## What it does

**Parents (no account needed)**

- Start on the home page (`/`): what the free trial is, the next open times in their own zone, and buttons to book, sign in or create an account.
- Pick a day on a month calendar and a time in their own zone (auto-detected, changeable). Only times between 8 AM and 9 PM local, inside a mentor's shift, at least 2 hours away and within 14 days are offered.
- Full times are shown (dashed) and open suggestions: same day → same time on nearby days → closest good times.
- Book with parent and child details. Then get a confirmation with the class link, Google Calendar / `.ics` export, the mentor's India time, and a **private manage link** to view or cancel.
- Optionally create an account with the same email, verify it, and see every booking in **My bookings**.

**Admin**

- Dashboard: booked vs capacity per India date.
- Bookings: search, filter, quick-look sheet, a full booking page at `/admin/bookings/:reference`, cancel. Admins who open a parent's `/booking/...` URL are sent to the admin view.
- Parents: account status and history.
- Mentors: weekly shift and 14-day schedule with `n / 2` load.
- Outbox.

**How the hard parts are handled**

| Concern          | Approach                                                                                                                                                                                  |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Time zones / DST | All instants stored in UTC; zones are IANA names; windows built per local date with Luxon, never fixed offsets. Labels never show a bare "IST" (India vs Irish).                          |
| Reasonable hours | Parent window 08:00–21:00 local **and** the mentor's own shift (region-aligned shifts, including US night shifts in India; no global IST cap).                                            |
| Capacity         | ≤ 2 confirmed trials per mentor per **India calendar date**, checked inside a locked transaction.                                                                                         |
| Concurrency      | One short transaction per candidate mentor with parent and mentor row locks; a Postgres `EXCLUDE` constraint makes overlapping bookings impossible; `Idempotency-Key` makes retries safe. |
| Fair assignment  | Least-loaded mentor that day, then the one with the fewest other open slots, then id.                                                                                                     |
| Privacy          | Guest bookings are reachable only via an HMAC manage link; accounts require email verification; admin is separate; ownership failures return 404.                                         |

## Screenshots

Captured from the running app (seeded data, browser in New York unless noted) with headless Chrome. Every image is in [`docs/screenshots/`](docs/screenshots/).

### Home page

The first page a visitor sees: what the trial is, the ways in (book, sign in, create an account) and the **next open times in the visitor's own zone**, loaded live.

<img src="docs/screenshots/01-landing.png" alt="Landing page" width="100%">

### Booking a trial (guest, no account)

<table>
<tr>
<td width="50%" valign="top"><img src="docs/screenshots/02-book-pick-time.png" alt="Pick a time" width="100%"><br><b>Pick a time</b><br><sub>Month calendar with availability dots; times for the chosen day in the parent's zone (detected: Eastern Time). Morning / Afternoon groups, 12h/24h toggle.</sub></td>
<td width="50%" valign="top"><img src="docs/screenshots/05-book-details.png" alt="Your details" width="100%"><br><b>Your details</b><br><sub>The chosen time stays pinned on the left with “Change time”. Parent, child, grade and subject.</sub></td>
</tr>
</table>
<table>
<tr>
<td width="50%" valign="top"><img src="docs/screenshots/07-confirmation.png" alt="Confirmation" width="100%"><br><b>Confirmation</b><br><sub>Parent's time and the mentor's India time, assigned mentor, class link, Google / .ics calendar, reference and a private manage link. Guests are invited to create an account.</sub></td>
<td width="50%" valign="top"><img src="docs/screenshots/09-book-london.png" alt="Same calendar, London family" width="100%"><br><b>Same calendar, London family</b><br><sub>Times re-render for UK time (BST) and the week starts on Monday: afternoon and after-school evening slots from the UK-shift mentors.</sub></td>
</tr>
</table>

### When a time can't be booked

<table>
<tr>
<td width="50%" valign="top"><img src="docs/screenshots/03-book-full-time-suggestions.png" alt="A full time → same-day alternatives" width="100%"><br><b>A full time → same-day alternatives</b><br><sub>Seeded full slot (9:00 AM). “9:00 AM is taken” with the nearest open times that day, one click to pick.</sub></td>
<td width="50%" valign="top"><img src="docs/screenshots/04-book-full-day.png" alt="A fully booked day → same time on nearby days" width="100%"><br><b>A fully booked day → same time on nearby days</b><br><sub>Red-dot day. The cascade falls through to the same local time on the nearest days that have it.</sub></td>
</tr>
</table>
<table>
<tr>
<td width="50%" valign="top"><img src="docs/screenshots/06-book-validation.png" alt="Validation" width="100%"><br><b>Validation</b><br><sub>Shared zod schema on client and server; every invalid field is flagged and the first one is focused.</sub></td>
<td width="50%" valign="top"><img src="docs/screenshots/08-book-active-trial-exists.png" alt="One upcoming trial per family" width="100%"><br><b>One upcoming trial per family</b><br><sub>A second booking with the same email shows the existing trial instead of a dead end; form kept.</sub></td>
</tr>
</table>

### Accounts (optional)

<table>
<tr>
<td width="50%" valign="top"><img src="docs/screenshots/10-signup.png" alt="Create an account" width="100%"><br><b>Create an account</b><br><sub>Optional. Use the email you booked with.</sub></td>
<td width="50%" valign="top"><img src="docs/screenshots/11-signup-check-email.png" alt="Check your email" width="100%"><br><b>Check your email</b><br><sub>Same answer for new and existing emails (no account enumeration).</sub></td>
</tr>
</table>
<table>
<tr>
<td width="50%" valign="top"><img src="docs/screenshots/12-dev-outbox.png" alt="Dev outbox" width="100%"><br><b>Dev outbox</b><br><sub>No real email is sent; verification, reset and booking emails land here with clickable links.</sub></td>
<td width="50%" valign="top"><img src="docs/screenshots/13-email-verified.png" alt="Email verified" width="100%"><br><b>Email verified</b><br><sub>Single-use link, valid 24 hours.</sub></td>
</tr>
</table>
<table>
<tr>
<td width="50%" valign="top"><img src="docs/screenshots/14-login.png" alt="Sign in" width="100%"><br><b>Sign in</b><br><sub>Email and password; link to reset.</sub></td>
<td width="50%" valign="top"><img src="docs/screenshots/15-login-wrong-password.png" alt="Wrong password" width="100%"><br><b>Wrong password</b><br><sub>One generic message for unknown email or wrong password. Rate-limited.</sub></td>
</tr>
</table>
<table>
<tr>
<td width="50%" valign="top"><img src="docs/screenshots/17-login-unverified.png" alt="Not verified yet" width="100%"><br><b>Not verified yet</b><br><sub>Correct password but unverified: prompt to verify, with “Send a new link”.</sub></td>
<td width="50%" valign="top"><img src="docs/screenshots/16-my-bookings-after-signup.png" alt="My bookings after sign-up" width="100%"><br><b>My bookings after sign-up</b><br><sub>The guest booking made before signing up appears once the email is verified.</sub></td>
</tr>
</table>
<table>
<tr>
<td width="50%" valign="top"><img src="docs/screenshots/18-forgot-password.png" alt="Forgot password" width="100%"><br><b>Forgot password</b><br><sub>Request a reset link.</sub></td>
<td width="50%" valign="top"><img src="docs/screenshots/19-forgot-password-sent.png" alt="Reset link sent" width="100%"><br><b>Reset link sent</b><br><sub>Same response whether or not the account exists.</sub></td>
</tr>
</table>
<table>
<tr>
<td width="50%" valign="top"><img src="docs/screenshots/20-reset-password.png" alt="Set a new password" width="100%"><br><b>Set a new password</b><br><sub>Valid 1 hour; signs out every other session.</sub></td>
<td width="50%" valign="top"><img src="docs/screenshots/21-reset-link-expired.png" alt="Expired or used link" width="100%"><br><b>Expired or used link</b><br><sub>Clear way forward: request a new link.</sub></td>
</tr>
</table>

### My bookings (signed in)

<table>
<tr>
<td width="50%" valign="top"><img src="docs/screenshots/22-my-bookings-upcoming.png" alt="My bookings: upcoming" width="100%"><br><b>My bookings: upcoming</b><br><sub>Verified demo parent (London). View or cancel.</sub></td>
<td width="50%" valign="top"><img src="docs/screenshots/23-my-bookings-past.png" alt="My bookings: past and cancelled" width="100%"><br><b>My bookings: past and cancelled</b><br><sub>Completed and cancelled trials.</sub></td>
</tr>
</table>
<table>
<tr>
<td width="50%" valign="top"><img src="docs/screenshots/24-account-menu.png" alt="Account menu" width="100%"><br><b>Account menu</b><br><sub>Signed-in header: Book a trial, avatar menu with My bookings and Sign out.</sub></td>
<td width="50%" valign="top"><img src="docs/screenshots/25-landing-signed-in.png" alt="Home page, signed in" width="100%"><br><b>Home page, signed in</b><br><sub>Hero swaps “Sign in” for “My bookings”.</sub></td>
</tr>
</table>

### Managing and cancelling

<table>
<tr>
<td width="50%" valign="top"><img src="docs/screenshots/26-cancel-confirm.png" alt="Cancel from the private link" width="100%"><br><b>Cancel from the private link</b><br><sub>No account needed. Confirm before cancelling.</sub></td>
<td width="50%" valign="top"><img src="docs/screenshots/27-booking-cancelled.png" alt="Cancelled" width="100%"><br><b>Cancelled</b><br><sub>The time is free again for other families; parent and mentor are notified (see the outbox).</sub></td>
</tr>
</table>
<table>
<tr>
<td width="50%" valign="top"><img src="docs/screenshots/28-booking-not-found.png" alt="Wrong or missing token" width="100%"><br><b>Wrong or missing token</b><br><sub>Returns “not found”, never another family's booking.</sub></td>
<td width="50%" valign="top"><img src="docs/screenshots/41-not-found.png" alt="Unknown page" width="100%"><br><b>Unknown page</b><br><sub>Friendly 404 with a way home.</sub></td>
</tr>
</table>

### Admin console

<table>
<tr>
<td width="50%" valign="top"><img src="docs/screenshots/30-admin-login.png" alt="Admin sign-in" width="100%"><br><b>Admin sign-in</b><br><sub>Separate session from parents; parent cookies never unlock admin.</sub></td>
<td width="50%" valign="top"><img src="docs/screenshots/31-admin-dashboard.png" alt="Dashboard" width="100%"><br><b>Dashboard</b><br><sub>Trials today and next 7 days, capacity used, fully booked days, and booked vs capacity per India date.</sub></td>
</tr>
</table>
<table>
<tr>
<td width="50%" valign="top"><img src="docs/screenshots/32-admin-bookings.png" alt="Bookings" width="100%"><br><b>Bookings</b><br><sub>Search and filter by time, status and mentor. India time first, the parent's time alongside.</sub></td>
<td width="50%" valign="top"><img src="docs/screenshots/33-admin-booking-sheet.png" alt="Quick look" width="100%"><br><b>Quick look</b><br><sub>Side sheet with facts and every message sent for the booking.</sub></td>
</tr>
</table>
<table>
<tr>
<td width="50%" valign="top"><img src="docs/screenshots/34-admin-booking-detail.png" alt="Booking page" width="100%"><br><b>Booking page</b><br><sub>Full detail at /admin/bookings/:reference, with copy link and cancel.</sub></td>
<td width="50%" valign="top"><img src="docs/screenshots/35-admin-cancel-dialog.png" alt="Admin cancel" width="100%"><br><b>Admin cancel</b><br><sub>Confirms first; parent and mentor are told it was cancelled by the team.</sub></td>
</tr>
</table>
<table>
<tr>
<td width="50%" valign="top"><img src="docs/screenshots/36-admin-parents.png" alt="Parents" width="100%"><br><b>Parents</b><br><sub>Account status (Guest / Pending / Verified) and booking counts.</sub></td>
<td width="50%" valign="top"><img src="docs/screenshots/37-admin-parent-detail.png" alt="Parent detail" width="100%"><br><b>Parent detail</b><br><sub>Every booking for that email.</sub></td>
</tr>
</table>
<table>
<tr>
<td width="50%" valign="top"><img src="docs/screenshots/38-admin-mentors.png" alt="Mentors" width="100%"><br><b>Mentors</b><br><sub>Region-aligned shift, today's load (n / 2) and day off.</sub></td>
<td width="50%" valign="top"><img src="docs/screenshots/39-admin-mentor-schedule.png" alt="Mentor schedule" width="100%"><br><b>Mentor schedule</b><br><sub>Weekly shift and the next 14 India dates with each class and the parent's local time; red bar = 2 / 2.</sub></td>
</tr>
</table>
<table>
<tr>
<td width="50%" valign="top"><img src="docs/screenshots/40-admin-outbox.png" alt="Outbox" width="100%"><br><b>Outbox</b><br><sub>Every email the system would send.</sub></td>
<td width="50%"></td>
</tr>
</table>

### Dark mode and phones

<table>
<tr>
<td width="50%" valign="top"><img src="docs/screenshots/42-landing-dark.png" alt="Dark mode" width="100%"><br><b>Dark mode</b><br><sub>Follows the system setting.</sub></td>
<td width="50%" valign="top"><img src="docs/screenshots/43-book-dark.png" alt="Booking in dark mode" width="100%"><br><b>Booking in dark mode</b><br><sub></sub></td>
</tr>
</table>
<table>
<tr>
<td width="33%" valign="top"><img src="docs/screenshots/50-mobile-landing.png" alt="Home on a phone" width="100%"><br><b>Home on a phone</b><br><sub>390 px wide.</sub></td>
<td width="33%" valign="top"><img src="docs/screenshots/51-mobile-book.png" alt="Booking on a phone" width="100%"><br><b>Booking on a phone</b><br><sub>Panels stack: info, calendar, times.</sub></td>
<td width="33%" valign="top"><img src="docs/screenshots/52-mobile-admin-login.png" alt="Admin sign-in on a phone" width="100%"><br><b>Admin sign-in on a phone</b><br><sub></sub></td>
</tr>
</table>

## Quick start

**Prerequisites:** Node.js 20+ (developed on Node 26), npm 10+, Docker (for PostgreSQL 16).

```bash
cp .env.example .env          # dev defaults work as-is
npm install
npm run db:up                 # postgres for dev (5432) and tests (5433)
npm run db:migrate
npm run db:seed               # mentors, demo accounts and edge-case bookings
npm run dev                   # API on :4000, web on http://localhost:5173
```

> **npm 11 note:** npm 11 blocks dependency install scripts by default. If `npm install` warns about `prisma`, `@prisma/engines`, `@prisma/client` or `esbuild`, run
> `npm approve-scripts @prisma/client prisma @prisma/engines esbuild && npm rebuild`.

Open <http://localhost:5173>. See [Running the app](#running-the-app) for ports and [Database](#database) to inspect the data.

| Who                 | Where         | Login                                        |
| ------------------- | ------------- | -------------------------------------------- |
| Parent (guest)      | `/book`       | none                                         |
| Parent (verified)   | `/login`      | `demo.parent@example.com` / `Parent123!`     |
| Parent (unverified) | `/login`      | `pending.parent@example.com` / `Pending123!` |
| Admin               | `/admin`      | `admin@trialdesk.example` / `Admin123!`      |
| Emails (dev only)   | `/dev/outbox` | none                                         |

No real email is sent. Every confirmation, cancellation, verification and reset email lands in the **dev outbox**, where the links are clickable.

## Running the app

`npm run dev` starts both servers together (output is prefixed `[api]` and `[web]`):

| Service       | URL                         | What it is                                                                          |
| ------------- | --------------------------- | ----------------------------------------------------------------------------------- |
| Web app       | <http://localhost:5173>     | Vite dev server (React). Proxies `/api/*` to the API, so cookies stay same-origin   |
| API           | <http://localhost:4000/api> | Express server; health check at <http://localhost:4000/api/health>                  |
| Dev database  | `localhost:5432`            | PostgreSQL 16 in Docker (`trialbooking`), data kept in a Docker volume              |
| Test database | `localhost:5433`            | PostgreSQL 16 in Docker (`trialbooking_test`), in memory, rebuilt on every test run |

Run them separately when you want separate terminals:

```bash
npm run dev -w apps/api      # API only, restarts on file changes
npm run dev -w apps/web      # web only (needs the API running for data)
npm run start -w apps/api    # API without file watching
```

Quick checks that everything is up:

```bash
curl http://localhost:4000/api/health                      # {"status":"ok","db":"ok"}
curl "http://localhost:4000/api/slots?tz=America/New_York&days=1"
docker compose ps                                          # both postgres containers "healthy"
```

Stop everything with `Ctrl+C` in the `npm run dev` terminal, then `npm run db:down` to stop Postgres. The dev data survives `db:down`. To delete it too, run `docker compose down -v`.

## Database

### Look at the data

| Way                                                        | Command                        | Notes                                                                             |
| ---------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------- |
| **Prisma Studio** (browser UI)                             | `npm run db:studio`            | Opens <http://localhost:5555>; browse and filter every table and follow relations |
| **psql** (terminal, nothing to install)                    | `npm run db:psql`              | `\dt` lists tables, `\d "Booking"` shows columns and constraints, `\q` quits      |
| **Desktop client** (TablePlus, DBeaver, pgAdmin, DataGrip) | connect with the details below | Use the dev database; the test one is emptied between runs                        |
| **Admin console**                                          | <http://localhost:5173/admin>  | The same data through the app: bookings, parents, mentor schedules, outbox        |

| Connection      | Dev                                                          | Test                                                              |
| --------------- | ------------------------------------------------------------ | ----------------------------------------------------------------- |
| Host / port     | `localhost` / `5432`                                         | `localhost` / `5433`                                              |
| User / password | `postgres` / `postgres`                                      | `postgres` / `postgres`                                           |
| Database        | `trialbooking`                                               | `trialbooking_test`                                               |
| URL             | `postgresql://postgres:postgres@localhost:5432/trialbooking` | `postgresql://postgres:postgres@localhost:5433/trialbooking_test` |

### Tables

| Table                               | Holds                                                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `Mentor`                            | The 10 mentors: zone (`Asia/Kolkata`), shift label, daily cap (`maxDailyTrials`)                             |
| `AvailabilityRule`                  | Each mentor's weekly shift: one row per working weekday (`weekday` 1 = Mon, minutes since local midnight)    |
| `Parent`                            | Everyone who booked or signed up. `passwordHash` empty = guest; `emailVerifiedAt` empty = pending            |
| `Booking`                           | Trials: `startUtc`/`endUtc` in UTC, `mentorLocalDate` (the India date the cap counts on), both zones, status |
| `OutboxMessage`                     | Every email the app would send (booking, cancellation, verification, reset)                                  |
| `Session`, `AuthToken`, `AdminUser` | Sign-in sessions (hashed), verification/reset tokens (hashed), the admin account                             |

Integrity rules live in the database, not only in code: an `EXCLUDE` constraint stops two confirmed bookings overlapping for one mentor, and `CHECK` constraints guard grades, weekdays and shift bounds (`apps/api/prisma/migrations/*_constraints`).

### Useful queries

Run these in `npm run db:psql` or any client:

```sql
-- Upcoming bookings with mentor and parent
SELECT b.reference, b."startUtc", b."mentorLocalDate", m.name AS mentor, p.email, b.status
FROM "Booking" b JOIN "Mentor" m ON m.id = b."mentorId" JOIN "Parent" p ON p.id = b."parentId"
WHERE b."startUtc" > now() ORDER BY b."startUtc";

-- Trials per mentor per India date (never more than 2)
SELECT m.name, b."mentorLocalDate", count(*) AS trials
FROM "Booking" b JOIN "Mentor" m ON m.id = b."mentorId"
WHERE b.status = 'CONFIRMED' GROUP BY 1, 2 ORDER BY 2, 1;

-- One booking in the parent's and the mentor's local time
SELECT reference,
       "startUtc" AT TIME ZONE "parentTimezone" AS parent_local,
       "startUtc" AT TIME ZONE "mentorTimezone" AS mentor_local
FROM "Booking" ORDER BY "startUtc" LIMIT 10;

-- Parents and their account state
SELECT name, email,
       CASE WHEN "passwordHash" IS NULL THEN 'guest' WHEN "emailVerifiedAt" IS NULL THEN 'pending' ELSE 'verified' END AS account
FROM "Parent" ORDER BY name;

-- Latest emails (verification and reset links are in the body)
SELECT "createdAt", kind, "toEmail", subject FROM "OutboxMessage" ORDER BY "createdAt" DESC LIMIT 10;
```

### Reset, reseed and migrate

| Task                                               | Command                                                                                            |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Replace all dev data with fresh demo data          | `npm run db:seed` (**deletes everything in the dev database first**)                               |
| Apply migrations                                   | `npm run db:migrate`                                                                               |
| Drop and recreate the dev database from migrations | `npm run db:reset`, then `npm run db:seed`                                                         |
| Start from a completely empty Postgres             | `docker compose down -v && npm run db:up && npm run db:migrate && npm run db:seed`                 |
| Change the schema                                  | edit `apps/api/prisma/schema.prisma`, then `npm run db:migrate:dev -w apps/api -- --name <change>` |
| Watch Postgres logs                                | `npm run db:logs`                                                                                  |

The seed builds its scenarios relative to _today_, so reseed if the demo data has drifted into the past.

### Troubleshooting

| Symptom                                                                       | Fix                                                                                                                                    |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `db: unreachable` from `/api/health`, or `P1001: Can't reach database server` | Start Docker Desktop, then `npm run db:up`                                                                                             |
| `port is already allocated` on 5432 or 5433                                   | Another Postgres is running. Stop it, or change the left-hand port in `docker-compose.yml` and the matching URL in `.env`              |
| `The table "public.Mentor" does not exist`                                    | Run `npm run db:migrate`                                                                                                               |
| Booking page shows no times                                                   | Run `npm run db:seed` (mentors come from the seed), and check the time zone isn't one where no mentor works at family-friendly hours   |
| `@prisma/client did not initialize yet`                                       | `npx prisma generate --schema apps/api/prisma/schema.prisma` (or rerun `npm install` after approving install scripts, see Quick start) |
| Integration tests fail to start                                               | `npm run db:up`. The test container must be healthy on port 5433                                                                       |

## Tests

```bash
npm test                  # everything (shared, api, web)
npm run test:unit         # time module, slot engine, suggestions, assignment, tokens
npm run test:integration  # API against a real Postgres (port 5433)
npm run typecheck
npm run lint              # ESLint, including the architecture-boundary rules
npm run format:check      # Prettier
npm run build
```

Highlights:

- the PRD's per-zone coverage table as fixtures, before and after the Oct/Nov 2026 clock changes;
- a property test (fast-check) that no slot ever falls outside the parent window or a mentor's shift;
- **10 parents racing for the last mentor → exactly one 201, nine 409s with suggestions**;
- 30 parallel bookings never exceed 2 per mentor per India date or overlap;
- idempotent replays, including concurrent ones;
- enumeration-safe sign-up and sign-in;
- single-use tokens;
- reset ends all sessions;
- parent cookies never unlock admin;
- cross-origin writes are blocked.

Integration tests recreate the `*_test` database schema on each run. The setup refuses any database whose name doesn't end in `_test`.

## Manual test script

The seed creates its scenarios relative to _today_.

1. **Home page.** Open `/`. The hero card lists the next open times in your zone; “Book a free trial” and the subject cards lead to `/book` (the subject cards preselect Coding or Maths).
2. **Time zones.** Open `/book`, then change the time zone (top-left) to London, then Los Angeles. Times re-render in each zone; UK weeks start on Monday, US weeks on Sunday.
3. **Clock change.** Set `BOOKING_HORIZON_DAYS=30` in `.env` and restart. In New York, a "Clocks go back Sun 1 Nov" notice appears, and the same mentor shift shows an hour earlier after 1 Nov.
4. **Full slot.** In New York, open _today + 2_. 9:30 AM is dashed **Full**. Click it to see same-day alternatives.
5. **Full day.** _Today + 4_ (New York) has a red dot. Opening it shows the same time on nearby days.
6. **Race.** Open the same time in two windows with different emails and submit both. One gets the confirmation; the other sees "That time was just booked" with alternatives.
7. **Already has a trial.** Book again with an email that has an upcoming trial. You're shown the existing trial instead.
8. **Account.** Sign up with a guest's email (e.g. `guest.parent@example.com`), verify from `/dev/outbox`, sign in. The earlier guest booking appears in My bookings.
9. **Admin.** At `/admin/mentors`, one UK-shift mentor is at 2 / 2 for tomorrow's India date. Cancel a booking from `/admin/bookings`. The parent and mentor messages appear in the outbox, and the time is bookable again.

## Configuration

All settings are in `.env` (see [`.env.example`](.env.example)) and validated at startup.

| Variable                                       | Default                 | Meaning                                               |
| ---------------------------------------------- | ----------------------- | ----------------------------------------------------- |
| `DATABASE_URL` / `TEST_DATABASE_URL`           | local docker            | Dev and test databases                                |
| `APP_BASE_URL`                                 | `http://localhost:5173` | Web origin, used for links, CORS and the origin check |
| `APP_SECRET`                                   | dev value               | HMAC key for manage links (32+ chars)                 |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD`               | see table above         | Seeded admin                                          |
| `DEV_OUTBOX_ENABLED`                           | `true`                  | Exposes `/api/dev/outbox`                             |
| `MIN_NOTICE_MINUTES` / `BOOKING_HORIZON_DAYS`  | `120` / `14`            | Booking window                                        |
| `CLASS_DURATION_MINUTES` / `SLOT_STEP_MINUTES` | `60` / `30`             | Class length, grid                                    |
| `DEFAULT_MAX_DAILY_TRIALS`                     | `2`                     | Per mentor per India date                             |
| `PARENT_HOURS_START` / `PARENT_HOURS_END`      | `08:00` / `21:00`       | Parent-friendly window                                |
| `RATE_LIMIT_ENABLED`                           | `true`                  | Booking and auth rate limits                          |

## Architecture

```
apps/web     React 19 + Vite + Tailwind v4 (shadcn-style components, Radix) + TanStack Query
apps/api     Express 5 + Prisma 6 + PostgreSQL 16
packages/shared   Luxon time module, zod schemas (used by web and api), error codes
```

- **API modules:** each module in `apps/api/src/modules/<name>/` has `routes → controller → service → repository`, plus a `mapper` (DB row → DTO) and an `index.ts` public API. Pure scheduling rules live in `domain/` (no DB or HTTP code).
- **Web features:** each feature in `apps/web/src/features/<name>/` has `api/` (TanStack Query hooks), `components/`, `pages/` (one page per file) and `index.ts`. Shared UI sits in `components/` (`ui`, `layout`, `booking`, `feedback`, `guards`), with `hooks/` and `lib/` alongside it; `app/` holds providers and the router.
- **Shared models:** every DTO is its own file in `packages/shared/src/models/*.model.ts`, imported by both apps as `@shared`.
- **Composition:** one root (`container.ts`) wires everything, so tests swap in a fixed clock and the test database.
- **Slots:** computed per request from mentor shifts; there is no slots table.

**Import aliases** (tsconfig `paths`; `vite-tsconfig-paths` in Vite/Vitest, `tsx` natively):

| Alias     | Points to                                     |
| --------- | --------------------------------------------- |
| `@shared` | `packages/shared/src` (models, schemas, time) |
| `@/…`     | the current app's `src/`                      |

**Enforced boundaries** (`eslint.config.js`):

- A web feature never imports another feature.
- `components/`, `hooks/` and `lib/` never import features or `app/`.
- API modules import each other only through `index.ts`.
- `domain/` stays pure.
- `packages/shared` stays framework-free.

See the [technical design](docs/TECHNICAL_DESIGN.md) for the data model, algorithms and decision records.

## Assumptions and trade-offs

- "Per day" for the 2-trial cap is the mentor's **India calendar date**; seeded shifts never cross India midnight.
- Mentors work **region-aligned shifts** (UK 1:00–11:30 PM IST, US-East 12:30–7:30 AM IST, US-West 3:30–9:30 AM IST), as Codeyoung and peers do. Parents never see times outside 8 AM–9 PM local.
- No soft holds while a parent types details. The final booking is atomic, and a lost race returns alternatives with the form kept.
- One upcoming free trial per email.
- **Out of scope:**
  - Real email (the outbox stands in).
  - Mentor login (the admin console covers schedules).
  - Rescheduling (cancel and rebook instead).
  - Mentor time-off, subject matching and a waitlist.

## Project layout

```
packages/shared/src/
  constants/ errors/ models/*.model.ts schemas/*.schema.ts time/ utils/   index.ts (barrel → @shared)
apps/api/src/
  main.ts app.ts container.ts
  core/      config, clock, logger, db
  http/      errors, validate, cookies, request-context, middleware/{session,origin-check,rate-limit}
  domain/    scheduling/{slot-engine,suggestions,assignment}  security/tokens  booking/reference
  modules/   slots bookings auth admin me outbox parents dev health
             └─ <name>.routes · .controller · .service · .repository · .mapper · index.ts
apps/api/prisma/   schema.prisma migrations/ seed.ts
apps/api/test/     unit/ integration/
apps/web/src/
  main.tsx  app/{providers,router,NotFoundPage}
  components/{ui,layout,booking,feedback,guards}  hooks/  lib/{api-client,query-keys,session,…}
  features/  landing booking manage-booking my-bookings auth admin dev
             └─ api/ components/ pages/ index.ts
docs/        PRD, technical design, API, prototype, plan
```
