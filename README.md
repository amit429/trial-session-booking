# TrialDesk: trial-class booking

Parents in the US, UK and Ireland book a free 1:1 trial class. A free mentor in India is assigned at once (at most **2 trials per mentor per India date**). Every time is shown correctly in each person's own zone, including across Daylight Saving Time changes. When a time is taken, parents get the nearest good alternatives instead of a dead end.

Built for the Codeyoung Senior Full Stack Engineer assignment. "TrialDesk" is a placeholder brand.

| | |
|---|---|
| Product spec | [`docs/PRD.md`](docs/PRD.md) |
| Technical design | [`docs/TECHNICAL_DESIGN.md`](docs/TECHNICAL_DESIGN.md) |
| API reference | [`docs/API.md`](docs/API.md) |
| Clickable UI prototype | [`docs/ui-prototype.html`](docs/ui-prototype.html) (open in a browser) |
| Implementation plan | [`docs/superpowers/plans/2026-10-08-trial-booking.md`](docs/superpowers/plans/2026-10-08-trial-booking.md) |
| AI transcript | [`TRANSCRIPT.md`](TRANSCRIPT.md) |

## What it does

**Parents (no account needed)**
- Pick a day on a month calendar and a time in their own zone (auto-detected, changeable). Only times between 8 AM and 9 PM local, inside a mentor's shift, at least 2 hours away and within 14 days are offered.
- Full times are shown (dashed) and open suggestions: same day → same time on nearby days → closest good times.
- Book with parent and child details. Then get a confirmation with the class link, Google Calendar / `.ics` export, the mentor's India time, and a **private manage link** to view or cancel.
- Optionally create an account with the same email, verify it, and see every booking in **My bookings**.

**Admin**
- Dashboard: booked vs capacity per India date.
- Bookings: search, filter, detail sheet, cancel.
- Parents: account status and history.
- Mentors: weekly shift and 14-day schedule with `n / 2` load.
- Outbox.

**How the hard parts are handled**

| Concern | Approach |
|---|---|
| Time zones / DST | All instants stored in UTC; zones are IANA names; windows built per local date with Luxon, never fixed offsets. Labels never show a bare "IST" (India vs Irish). |
| Reasonable hours | Parent window 08:00–21:00 local **and** the mentor's own shift (region-aligned shifts, including US night shifts in India; no global IST cap). |
| Capacity | ≤ 2 confirmed trials per mentor per **India calendar date**, checked inside a locked transaction. |
| Concurrency | One short transaction per candidate mentor with parent and mentor row locks; a Postgres `EXCLUDE` constraint makes overlapping bookings impossible; `Idempotency-Key` makes retries safe. |
| Fair assignment | Least-loaded mentor that day, then the one with the fewest other open slots, then id. |
| Privacy | Guest bookings are reachable only via an HMAC manage link; accounts require email verification; admin is separate; ownership failures return 404. |

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

Open <http://localhost:5173>.

| Who | Where | Login |
|---|---|---|
| Parent (guest) | `/book` | none |
| Parent (verified) | `/login` | `demo.parent@example.com` / `Parent123!` |
| Parent (unverified) | `/login` | `pending.parent@example.com` / `Pending123!` |
| Admin | `/admin` | `admin@trialdesk.example` / `Admin123!` |
| Emails (dev only) | `/dev/outbox` | none |

No real email is sent. Every confirmation, cancellation, verification and reset email lands in the **dev outbox**, where the links are clickable.

## Tests

```bash
npm test                  # everything (shared, api, web)
npm run test:unit         # time module, slot engine, suggestions, assignment, tokens
npm run test:integration  # API against a real Postgres (port 5433)
npm run typecheck
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

The seed creates its scenarios relative to *today*.

1. **Time zones.** Open `/book`, then change the time zone (top-left) to London, then Los Angeles. Times re-render in each zone; UK weeks start on Monday, US weeks on Sunday.
2. **Clock change.** Set `BOOKING_HORIZON_DAYS=30` in `.env` and restart. In New York, a "Clocks go back Sun 1 Nov" notice appears, and the same mentor shift shows an hour earlier after 1 Nov.
3. **Full slot.** In New York, open *today + 2*. 9:30 AM is dashed **Full**. Click it to see same-day alternatives.
4. **Full day.** *Today + 4* (New York) has a red dot. Opening it shows the same time on nearby days.
5. **Race.** Open the same time in two windows with different emails and submit both. One gets the confirmation; the other sees "That time was just booked" with alternatives.
6. **Already has a trial.** Book again with an email that has an upcoming trial. You're shown the existing trial instead.
7. **Account.** Sign up with a guest's email (e.g. `guest.parent@example.com`), verify from `/dev/outbox`, sign in. The earlier guest booking appears in My bookings.
8. **Admin.** At `/admin/mentors`, one UK-shift mentor is at 2 / 2 for tomorrow's India date. Cancel a booking from `/admin/bookings`. The parent and mentor messages appear in the outbox, and the time is bookable again.

## Configuration

All settings are in `.env` (see [`.env.example`](.env.example)) and validated at startup.

| Variable | Default | Meaning |
|---|---|---|
| `DATABASE_URL` / `TEST_DATABASE_URL` | local docker | Dev and test databases |
| `APP_BASE_URL` | `http://localhost:5173` | Web origin, used for links, CORS and the origin check |
| `APP_SECRET` | dev value | HMAC key for manage links (32+ chars) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | see table above | Seeded admin |
| `DEV_OUTBOX_ENABLED` | `true` | Exposes `/api/dev/outbox` |
| `MIN_NOTICE_MINUTES` / `BOOKING_HORIZON_DAYS` | `120` / `14` | Booking window |
| `CLASS_DURATION_MINUTES` / `SLOT_STEP_MINUTES` | `60` / `30` | Class length, grid |
| `DEFAULT_MAX_DAILY_TRIALS` | `2` | Per mentor per India date |
| `PARENT_HOURS_START` / `PARENT_HOURS_END` | `08:00` / `21:00` | Parent-friendly window |
| `RATE_LIMIT_ENABLED` | `true` | Booking and auth rate limits |

## Architecture

```
apps/web     React 19 + Vite + Tailwind v4 (shadcn-style components, Radix) + TanStack Query
apps/api     Express 5 + Prisma 6 + PostgreSQL 16
packages/shared   Luxon time module, zod schemas (used by web and api), error codes
```

- **API layers:** routes → services → pure domain functions (`slotEngine`, `suggestions`, `assignment`) → Prisma.
- **Composition:** one root (`container.ts`) wires everything, so tests swap in a fixed clock and the test database.
- **Slots:** computed per request from mentor shifts; there is no slots table.

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
apps/api/src/{domain,services,routes,http}   apps/api/prisma/{schema.prisma,migrations,seed.ts}
apps/api/test/{unit,integration}             apps/web/src/{features,components,lib}
packages/shared/src/{time,schemas.ts,errors.ts}
docs/                                         PRD, technical design, API, prototype, plan
```
