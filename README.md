# TrialDesk: trial-class booking

Parents in the US, UK and Ireland book a free 1:1 trial class. A free mentor in India is assigned at once (at most **2 trials per mentor per India date**). Every time is shown correctly in each person's own zone, including across Daylight Saving Time changes. When a time is taken, parents get the nearest good alternatives instead of a dead end.

Built for the Codeyoung Senior Full Stack Engineer assignment. "TrialDesk" is a placeholder brand.

|                        |                                                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| Product spec           | [`docs/PRD.md`](docs/PRD.md)                                                                               |
| Technical design       | [`docs/TECHNICAL_DESIGN.md`](docs/TECHNICAL_DESIGN.md)                                                     |
| API reference          | [`docs/API.md`](docs/API.md)                                                                               |
| Clickable UI prototype | [`docs/ui-prototype.html`](docs/ui-prototype.html) (open in a browser)                                     |
| Implementation plan    | [`docs/superpowers/plans/2026-10-08-trial-booking.md`](docs/superpowers/plans/2026-10-08-trial-booking.md) |
| AI transcript          | [`TRANSCRIPT.md`](TRANSCRIPT.md)                                                                           |

## What it does

**Parents (no account needed)**

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

1. **Time zones.** Open `/book`, then change the time zone (top-left) to London, then Los Angeles. Times re-render in each zone; UK weeks start on Monday, US weeks on Sunday.
2. **Clock change.** Set `BOOKING_HORIZON_DAYS=30` in `.env` and restart. In New York, a "Clocks go back Sun 1 Nov" notice appears, and the same mentor shift shows an hour earlier after 1 Nov.
3. **Full slot.** In New York, open _today + 2_. 9:30 AM is dashed **Full**. Click it to see same-day alternatives.
4. **Full day.** _Today + 4_ (New York) has a red dot. Opening it shows the same time on nearby days.
5. **Race.** Open the same time in two windows with different emails and submit both. One gets the confirmation; the other sees "That time was just booked" with alternatives.
6. **Already has a trial.** Book again with an email that has an upcoming trial. You're shown the existing trial instead.
7. **Account.** Sign up with a guest's email (e.g. `guest.parent@example.com`), verify from `/dev/outbox`, sign in. The earlier guest booking appears in My bookings.
8. **Admin.** At `/admin/mentors`, one UK-shift mentor is at 2 / 2 for tomorrow's India date. Cancel a booking from `/admin/bookings`. The parent and mentor messages appear in the outbox, and the time is bookable again.

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
