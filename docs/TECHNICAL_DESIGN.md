# Technical Design: Trial-Class Booking

| | |
|---|---|
| Status | Draft for review |
| Last updated | 2026-10-07 |
| Related | [PRD](./PRD.md) |

## 1. Overview

A React SPA talks to a Node.js (Express, TypeScript) REST API backed by PostgreSQL. Free slots are **computed from mentor availability rules on every request**. Booking correctness (no overlap, at most 2 trials per mentor per IST day, idempotency) is enforced by a **short locking transaction plus database constraints**.

## 2. Architecture

```
┌──────────── apps/web (Vite + React + TS) ────────────┐
│ Pages → feature components → hooks (TanStack Query)  │
│ → api client (fetch + zod-parsed responses)          │
└───────────────────────┬──────────────────────────────┘
                        │ JSON / REST   /api/*
┌───────────────────────▼──────── apps/api (Express + TS) ─────────┐
│ routes → controllers (zod validation, HTTP mapping)              │
│        → services: SlotService, BookingService,                   │
│          AssignmentStrategy, NotificationService, CalendarService │
│        → repositories (Prisma)    ← Clock, Config, Logger (DI)    │
│ domain/time: pure Luxon functions (rule expansion, grid, labels)  │
└───────────────────────┬──────────────────────────────────────────┘
                        │ Prisma (+ raw SQL for locks / constraints)
                 ┌──────▼──────┐
                 │ PostgreSQL  │   docker-compose: dev + test databases
                 └─────────────┘

packages/shared: zod schemas, DTO types, error codes, time-format helpers
```

**Repository layout (npm workspaces)**

```
apps/
  api/   src/{config,container,clock,http,routes,controllers,services,repositories,domain}
         prisma/{schema.prisma,migrations,seed.ts}
         test/{unit,integration}
  web/   src/{app,components/ui,features/{booking,confirmation,manage,mentor},lib}
packages/
  shared/ src/{schemas,errors,time}
docs/    PRD.md, TECHNICAL_DESIGN.md, API.md
```

**Layering rules**

- Controllers only parse/validate input and map results/errors to HTTP. No business logic.
- Services hold the business rules and depend on repository interfaces, a `Clock` and `Config`.
- `domain/time` and `packages/shared/time` are pure functions with no I/O, so they are heavily unit-tested.
- `container.ts` is the single composition root (manual DI). Tests swap in a `FixedClock` and a test DB.

## 3. Technology choices

| Concern | Choice | Reason |
|---|---|---|
| Frontend | React 18 + Vite + TypeScript | Required stack; fast dev server |
| Server state | TanStack Query | Caching, refetch-on-focus for fresh slots, mutation states |
| Forms | react-hook-form + zod | Same schemas validate on client and server |
| UI | Tailwind CSS + shadcn/ui (Radix) | Accessible primitives; we own the component code; token-based theming |
| Backend | Express + TypeScript | Small, well known, easy to read |
| DB | PostgreSQL 16 | Transactions, row locks, exclusion constraints |
| ORM | Prisma | Typed client + migrations; raw SQL where Prisma lacks features |
| Time | Luxon | First-class IANA zone support, DST-aware arithmetic |
| Logging | pino | Structured logs |
| Tests | Vitest, supertest, React Testing Library | One runner for all packages |

## 4. Architecture decisions (ADRs)

### ADR-1: PostgreSQL over Firebase / SQLite
The core risk is concurrent booking. Postgres gives `SELECT … FOR UPDATE`, unique and partial indexes, and **`EXCLUDE USING gist`** to make overlapping bookings impossible at the storage level. Firestore has no relational constraints. SQLite serializes writes but lacks exclusion constraints and row locks. Running Postgres via docker-compose keeps setup to one command, and the same `DATABASE_URL` works for Supabase or Neon if we deploy.

### ADR-2: Compute slots from rules instead of a slots table
Availability = *rules − confirmed bookings − mentors at daily capacity*. A materialized slots table would duplicate this state. It would need a regeneration job, could drift after cancellations or rule edits, and still couldn't enforce the per-day cap by itself. At 10 mentors × 14 days the computation is a few thousand in-memory checks after two queries. **Revisit** at hundreds or thousands of mentors (cache per day or a materialized view refreshed on booking).

### ADR-3: No soft holds during checkout
Holding a slot while a parent types details needs expiry and cleanup. Instead the final booking is atomic, and a lost race returns smart suggestions (§7.3) with the form data kept. At ~20 bookings/day, collisions are rare and this is the simpler correct design.

### ADR-4: Daily capacity counts on the mentor's local date
"Two trials per day" is about the mentor's workload, so the day is the mentor's calendar day (IST). We store `mentorLocalDate` on each booking at write time, so counting is a simple indexed query.

### ADR-5: Store instants in UTC, zones as IANA names
All instants are `timestamptz`. Zones are IANA names (`America/New_York`), never offsets. Bookings snapshot both parent and mentor zones so historical displays stay correct.

### ADR-6: Reasonable hours as two per-day windows, enforced on the server
A slot must sit inside the mentor's operating window (08:00–22:00 mentor-local) **and** the parent's friendly window (08:00–21:00 parent-local). We considered a static per-region list of allowed hours ("US gets 8–11 AM"), but that list is wrong for half the year because of DST. Computing both windows per local date with real zone rules stays correct through every clock change. Enforcing them in slot generation *and* in the booking endpoint means the UI can't be bypassed. Trade-off, documented in the PRD (§6.1): US East/Central parents only get morning slots, so the windows are configuration, not code.

### ADR-7: Show "Full" slots instead of hiding them
Hiding unavailable times makes parents wonder whether the calendar is broken. Showing them greyed (only where some mentor is normally working) explains *why* the time isn't bookable, and gives a natural entry point to suggestions.

## 5. Data model

```mermaid
erDiagram
  MENTOR ||--o{ AVAILABILITY_RULE : has
  MENTOR ||--o{ BOOKING : teaches
  PARENT ||--o{ BOOKING : makes
  BOOKING ||--o{ NOTIFICATION : produces

  MENTOR {
    uuid id PK
    text name
    text email UK
    text timezone "IANA, e.g. Asia/Kolkata"
    text bio
    int maxDailyTrials "default 2"
    bool isActive
  }
  AVAILABILITY_RULE {
    uuid id PK
    uuid mentorId FK
    int weekday "1=Mon..7=Sun, mentor-local"
    int startMinute "minutes since local midnight"
    int endMinute "> startMinute, <= 1440"
  }
  PARENT {
    uuid id PK
    text name
    text email UK "lowercased"
    text phone
    text timezone
  }
  BOOKING {
    uuid id PK
    text reference UK "CY-XXXXXX"
    uuid parentId FK
    uuid mentorId FK
    text childName
    int childGrade
    enum subject "CODING | MATH"
    timestamptz startUtc
    timestamptz endUtc
    date mentorLocalDate
    text parentTimezone "snapshot"
    text mentorTimezone "snapshot"
    text meetingUrl
    enum status "CONFIRMED | CANCELLED"
    timestamptz cancelledAt
    text idempotencyKey UK
  }
  NOTIFICATION {
    uuid id PK
    uuid bookingId FK
    enum recipientType "PARENT | MENTOR"
    text timezone
    text subject
    text body "rendered in recipient zone"
  }
```

**Constraints added through a raw SQL migration**

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Booking"
  ADD CONSTRAINT booking_time_valid CHECK ("endUtc" > "startUtc"),
  ADD CONSTRAINT booking_no_overlap_per_mentor
    EXCLUDE USING gist (
      "mentorId" WITH =,
      tstzrange("startUtc", "endUtc", '[)') WITH &&
    ) WHERE (status = 'CONFIRMED');

CREATE INDEX booking_mentor_day_confirmed
  ON "Booking" ("mentorId", "mentorLocalDate") WHERE status = 'CONFIRMED';

ALTER TABLE "AvailabilityRule"
  ADD CONSTRAINT rule_bounds CHECK ("startMinute" >= 0 AND "startMinute" < "endMinute" AND "endMinute" <= 1440),
  ADD CONSTRAINT rule_weekday CHECK (weekday BETWEEN 1 AND 7);
```

Rules can't span midnight (a 22:00–01:00 shift would be two rules). Rules must also sit inside the mentor operating window (08:00–22:00 by default). This is checked in the service layer because the window is configuration, and slot generation clips to it again as a safety net.

## 6. Time handling

| Function (`packages/shared/time` / `apps/api/domain/time`) | Purpose |
|---|---|
| `normalizeZone(zone)` | Validate an IANA zone (incl. aliases like `Asia/Calcutta`) and return the canonical name, or throw |
| `localDayWindow(date, zone)` | `[startOf('day'), startOf('day') + 1 day)` in `zone`, returned as UTC; correct on 23 h / 25 h days |
| `dayWindow(date, zone, startMin, endMin)` | A reasonable-hours window (e.g. 08:00–21:00) on one local date, as a UTC interval; DST-aware because it's built per date |
| `localClockMinutes(instant, zone)` | Minutes since local midnight, used for "same time T" matching and closeness ranking |
| `expandRules(rules, zone, fromUtc, toUtc)` | Turn weekly local rules into concrete UTC intervals for every local date that touches the window |
| `gridStarts(fromUtc, toUtc, stepMin)` | 30-minute aligned UTC instants |
| `mentorLocalDate(instant, zone)` | ISO date of the instant in the mentor's zone (capacity key) |
| `formatSlot(instant, zone, locale)` | `Sat 31 Oct · 8:30 AM EDT` |
| `formatZoneLabel(zone, instant)` | `Eastern Time (UTC−04:00)`, `India Standard Time (UTC+05:30)`, `Irish time (UTC+01:00)`; never a bare "IST" |
| `zoneAbbreviation(zone, instant)` | Small override map on top of `Intl`: US-English `Intl` prints London summer time as "GMT+1", so we map it to `BST`; Dublin → "Irish time"; Kolkata → "India time" in short form |
| `upcomingTransitions(zone, fromUtc, toUtc)` | Detect offset changes in the window for the DST banner |

**Why a UTC 30-minute grid works:** US, UK, Ireland and India offsets are all multiples of 30 minutes, so grid instants land on :00 / :30 local times for every target user. Zones with :45 offsets (e.g. Nepal) still work correctly; they just show :15 / :45 times.

## 7. Slot computation

`GET /api/slots?tz=America/New_York&from=2026-10-30&days=7`

### 7.1 Reasonable-hours windows

Every candidate class `[s, s + 60 min)` must lie fully inside **both**:

- **Mentor operating window**: `MENTOR_HOURS_START`–`MENTOR_HOURS_END` (08:00–22:00) on the mentor's local date, in the mentor's zone;
- **Parent-friendly window**: `PARENT_HOURS_START`–`PARENT_HOURS_END` (08:00–21:00) on the parent's local date, in the parent's zone.

Both are built with `dayWindow(date, zone, startMin, endMin)` **for each local date separately**. A DST change therefore moves the window in UTC automatically, with no offset maths. The windows are applied in three places, defence in depth:

1. rule validation (an availability rule outside operating hours is rejected on create/seed);
2. slot generation (rule intervals are clipped to the operating window; grid starts are filtered by the parent window);
3. booking (`POST /bookings` re-checks both and returns `422 OUTSIDE_HOURS`, so a hand-crafted request can't book 3 AM).

A side effect we want: the parent window starts at 08:00, so the DST-ambiguous (1:00–2:00 AM) and non-existent (2:00–3:00 AM) local times can never be offered to a parent.

### 7.2 Algorithm

1. `normalizeZone(tz)`. Window = parent-local start of `from` → start of `from + days`, clipped to `[now + MIN_NOTICE, now + HORIZON]`.
2. Query 1: active mentors + rules. Query 2: confirmed bookings overlapping the window ± 1 day (for IST-date counting).
3. Per mentor: expand rules to UTC intervals and clip them to that date's operating window. Build `bookedCount[mentorId][mentorLocalDate]` and busy intervals.
4. For each 30-min grid start `s` inside the parent-friendly window of its parent-local date:
   - `staffed` = mentors whose (clipped) availability contains the class;
   - `available` = staffed mentors with no overlapping booking **and** `bookedCount[m][mentorLocalDate(s)] < maxDailyTrials`.
   - `staffed = 0` → not returned (nobody works then; showing "Full" would mislead).
   - `available = 0` → returned with `status: "FULL"`.
   - otherwise `status: "OPEN"`.
5. Group by parent-local date. Each day gets `status`: `OPEN` (≥ 1 open slot), `FULL` (staffed slots exist, none open), or `CLOSED` (no staffed slots, e.g. no mentor shifts that weekday).

Response shape:

```json
{
  "timezone": "America/New_York",
  "days": [
    {
      "date": "2026-10-31",
      "status": "OPEN",
      "slots": [
        { "startUtc": "2026-10-31T12:00:00Z", "endUtc": "2026-10-31T13:00:00Z", "status": "OPEN", "availableMentors": 3 },
        { "startUtc": "2026-10-31T12:30:00Z", "endUtc": "2026-10-31T13:30:00Z", "status": "FULL", "availableMentors": 0 }
      ]
    }
  ],
  "transitions": [{ "atUtc": "2026-11-01T06:00:00Z", "fromOffset": -240, "toOffset": -300 }]
}
```

The API returns instants. The client formats them, so the confirmation, slot grid and mentor view all use the same shared formatter.

### 7.3 Suggestion engine (`SuggestionService.suggest`)

Used in three places, which all render the same `SuggestionsPanel`:

- parent clicks a `FULL` slot;
- parent opens a `FULL` day;
- `POST /bookings` loses a race (409) or the slot became too soon (422).

`GET /api/slots/suggestions?tz=America/New_York&date=2026-10-31&time=09:00`

Input is **parent-local date + wall-clock time** (not a UTC instant), because "same time on other days" means the same local clock time even across a DST change.

```
slots = SlotService.getSlots(tz, today, HORIZON)          -- already window-filtered
open  = slots where status == OPEN

1. SAME_DAY:   open on date D, sorted by |localMinutes(slot) − T|, ties → later first; take 4
2. SAME_TIME:  days d ≠ D (d ≥ today) where open has a slot at local time T,
               sorted by |d − D| (ties → later day); take 3
               + note days where T is outside the reasonable window (DST), for the message
3. NEAREST:    days after today with any open slot, in date order; on each day take up to 2
               slots closest to T; stop at 4 total
4. NONE:       empty
return { strategy, requested: { date, time, zone }, suggestions: [...], notes: [...] }
```

Design points:

- Computed from the **same slot list** as the calendar. A suggestion is therefore always bookable at that moment, inside both windows, notice and horizon.
- Ranking by closeness to T means a parent who asked for 9 AM sees 8:30 or 10:00 first, never a random early slot.
- The 409 response from `POST /bookings` includes this payload, so the UI needs no extra request.
- Pure function `rankSuggestions(slots, D, T, zone)`, which makes it easy to unit-test.

## 8. Booking algorithm

```
POST /api/bookings   Idempotency-Key: <uuid>

1. If a booking with this idempotencyKey exists → return it (same 201 body).
2. Validate body (zod), normalizeZone, slot on grid, now+notice ≤ start ≤ now+horizon,
   class inside mentor operating window and parent-friendly window.
   → 422 VALIDATION / SLOT_TOO_SOON / OUTSIDE_HOURS
3. candidates = AssignmentStrategy.rank(eligibleMentors(start))      -- outside the tx
4. for m in candidates:                       -- one SHORT transaction per attempt
     BEGIN
       upsert Parent (email lowercased); SELECT … FROM "Parent" WHERE id=$p FOR UPDATE
       if parent has CONFIRMED booking with startUtc > now → ROLLBACK, 409 ACTIVE_TRIAL_EXISTS
       SELECT … FROM "Mentor" WHERE id=$m FOR UPDATE           -- serialize per mentor
       overlap? count(mentorLocalDate) ≥ max?  → ROLLBACK, next candidate
       INSERT Booking (reference, meetingUrl, snapshots…)
          on 23P01 (exclusion) → ROLLBACK, next candidate
          on 23505 (reference) → regenerate and retry insert
       INSERT 2 Notifications (parent zone, mentor zone)
     COMMIT → 201
5. no candidate succeeded → 409 SLOT_UNAVAILABLE { suggestions: SuggestionService.suggest(D, T, tz) }
```

**Why this is safe**

- Two bookings for the same mentor serialize on the mentor row lock. The second one re-reads committed state and sees the first.
- Even if the app logic were wrong, the exclusion constraint rejects an overlapping insert.
- **No deadlocks:** each transaction holds at most *one parent lock and one mentor lock*, always taken in the order Parent → Mentor. Nobody waits for a parent while holding a mentor, so no lock cycle can form. (A single transaction walking all candidates would keep earlier mentor locks while waiting on the next one. Two requests that ranked mentors differently could then deadlock.)
- Two tabs of the same parent serialize on the parent lock, so the active-trial check is race-free.
- Idempotency: unique `idempotencyKey`. A concurrent duplicate hits `23505` and re-reads the winner's booking.

**AssignmentStrategy** (interface, default implementation `BalancedAssignment`):

1. fewest confirmed trials on that IST day (spread load fairly);
2. fewest *other* open slots that day (keep flexible mentors free for times only they can cover);
3. mentor id (deterministic tiebreak).

**Generated values**

- `reference`: `CY-` + 6 chars from an unambiguous alphabet (no 0/O/1/I), with a retry on collision.
- `meetingUrl`: `${MEETING_BASE_URL}/${reference}-${nanoid(10)}` (dummy, unguessable).

## 9. API

Base `/api`. Errors: `{ "error": { "code": "SLOT_UNAVAILABLE", "message": "…", "details": { … } } }`.

| Method | Path | Success | Errors |
|---|---|---|---|
| GET | `/health` | 200 `{ status, db }` | 503 |
| GET | `/slots?tz&from&days` | 200 slots payload (`OPEN` + `FULL` slots, day status) | 422 |
| GET | `/slots/suggestions?tz&date&time` | 200 `{ strategy, suggestions, notes }` | 422 |
| POST | `/bookings` + `Idempotency-Key` | 201 booking | 409 `SLOT_UNAVAILABLE` (with suggestions), `ACTIVE_TRIAL_EXISTS`; 422 `VALIDATION`, `SLOT_TOO_SOON` (with suggestions), `OUTSIDE_HOURS`; 429 |
| GET | `/bookings/:reference?email` | 200 booking | 404 (also when email doesn't match) |
| POST | `/bookings/:reference/cancel` `{ email }` | 200 booking (idempotent) | 404, 422 `ALREADY_STARTED` |
| GET | `/bookings/:reference/calendar.ics?email` | 200 `text/calendar` | 404 |
| GET | `/mentors` | 200 list | — |
| GET | `/mentors/:id/bookings?from&to` | 200 grouped by IST date with capacity + notifications | 404 |

Full request/response examples go in `docs/API.md`.

## 10. Frontend

**Routes:** `/` → redirect `/book` · `/book` · `/booking/:reference` · `/manage` · `/mentor`

**Booking page state machine**

```
selectTime ──pick slot──▶ details ──submit──▶ submitting
    ▲                        ▲                   │
    │                        └─ pick alternative ┤ 409 SLOT_UNAVAILABLE / 422 SLOT_TOO_SOON
    └────────── change time ─┘                   │ 409 ACTIVE_TRIAL_EXISTS → show existing
                                                 └ 201 → navigate /booking/:ref
```

**Key components**

| Component | Notes |
|---|---|
| `TimezoneBar` | Shows `Times in Eastern Time (UTC−04:00)` with a Change button opening a Radix combobox |
| `DayStrip` | 14 day pills, each with an availability dot (open / few / full) |
| `SlotGrid` | Slots grouped by time of day; roving-tabindex keyboard nav; `aria-label="Saturday 31 October, 8:30 AM Eastern Daylight Time"` |
| `DstBanner` | Appears when `transitions` is non-empty |
| `BookingForm` | react-hook-form + shared zod schema; selected slot pinned on top |
| `SlotButton` | `OPEN` = selectable; `FULL` = greyed with a "Full" tag, but clickable to open suggestions |
| `SuggestionsPanel` | One component for every "not available" case. Headline per strategy (same day / same time on other days / closest good times / none), one-click suggestion buttons, keeps form data |
| `ConfirmationCard` | Local time, mentor-zone time, mentor card, link copy, add-to-calendar, cancel |
| `MentorAgenda` | Grouped by IST date with `CapacityMeter` |

**States covered:** loading skeletons, a fully booked day, an empty horizon, 409/422 dialogs, network/5xx toast with retry, 404 booking lookup.

## 11. Design system

- **Base:** Tailwind CSS + shadcn/ui (Radix primitives): accessible by default, components live in our repo, themed through CSS variables.
- **Tokens:** primary violet `#6D28D9`, accent sunny yellow `#FACC15`, success `#16A34A`, warning `#D97706`, destructive `#DC2626`, slate neutrals; radius 12 px; 4 px spacing scale; two shadow levels.
- **Type:** Plus Jakarta Sans (fallback `system-ui`), 16 px base, tabular numerals for times.
- **Icons / feedback:** lucide-react, sonner toasts.
- **Not chosen:** MUI / Ant Design. Heavier bundles, and harder to restyle into a friendly consumer brand.

## 12. Configuration

| Variable | Default | Meaning |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/codeyoung` | Dev DB |
| `TEST_DATABASE_URL` | `…:5433/codeyoung_test` | Integration tests |
| `PORT` | `4000` | API port |
| `CORS_ORIGIN` | `http://localhost:5173` | Web origin |
| `MIN_NOTICE_MINUTES` | `120` | Earliest bookable offset from now |
| `BOOKING_HORIZON_DAYS` | `14` | Furthest bookable day |
| `SLOT_STEP_MINUTES` | `30` | Grid step |
| `CLASS_DURATION_MINUTES` | `60` | Trial length |
| `DEFAULT_MAX_DAILY_TRIALS` | `2` | Per-mentor cap (per IST day) |
| `MENTOR_HOURS_START` / `MENTOR_HOURS_END` | `08:00` / `22:00` | Mentor operating window, mentor-local |
| `PARENT_HOURS_START` / `PARENT_HOURS_END` | `08:00` / `21:00` | Parent-friendly window, parent-local |
| `SUGGESTIONS_SAME_DAY` / `_SAME_TIME` / `_NEAREST` | `4` / `3` / `4` | Max suggestions per strategy |
| `MEETING_BASE_URL` | `https://meet.codeyoung-demo.com/trial` | Dummy link base |

Parsed with zod on boot. The process exits with a clear message if any value is invalid.

## 13. Seed data

10 mentors in `Asia/Kolkata`, all shifts inside 08:00–22:00 IST:

- **6 afternoon–evening shift** (13:00–22:00 IST → UK daytime, US East/Central mornings);
- **4 morning shift** (08:00–14:00 IST → US West, Alaska and Hawaii evenings, UK mornings).

Bookings are seeded relative to *today* so reviewers see each edge state without setting anything up:

- one mentor already at 2/2 tomorrow;
- one slot `FULL` across every staffed mentor (→ suggestions step 1);
- one whole parent-local day `FULL` for US Eastern (→ suggestions step 2);
- one cancelled booking.

## 14. Testing strategy

| Level | What | Examples |
|---|---|---|
| Unit | Pure time + domain logic | DST day lengths (2026-11-01 NY = 25 h, 2027-03-14 NY = 23 h); 18:00 IST → 8:30 AM EDT on 31 Oct and 7:30 AM EST on 2 Nov; London BST→GMT on 25 Oct; Phoenix unaffected; Dublin label never "IST"; alias normalisation; rule expansion across dates; assignment ranking |
| Unit: windows & suggestions | `dayWindow`, slot filtering, `rankSuggestions` | Coverage per zone matches PRD §6.1 on 20 Oct and 10 Nov 2026 (e.g. LA: 8:00/8:30 AM + 7:30/8:00 PM PDT → only 6:30–8:00 PM PST); no slot ever outside either window (property test over all zones × 60 days); SAME_DAY ranks by closeness to T; full day → SAME_TIME; same local 9:00 AM before/after 1 Nov maps to different UTC; T missing everywhere → NEAREST with ≤ 2 per day; nothing open → NONE |
| Integration | API + real Postgres + `FixedClock` | Happy path; 2/day cap; `OUTSIDE_HOURS` on a hand-crafted 3 AM booking; 409 body contains suggestions; **10 concurrent POSTs with one free mentor → 1 × 201, 9 × 409**; 30 parallel bookings → no mentor > 2/day, no overlaps; idempotent replay; active-trial rule; too-soon; cancel frees capacity; exclusion constraint rejects direct overlapping insert |
| Frontend | React Testing Library | Slot labels in chosen zone; FULL slots render greyed and open suggestions; each suggestion strategy shows its headline; form validation messages |
| E2E (optional) | Playwright | Book → confirm → mentor view shows IST |

## 15. Future work

Auth (magic links), real email/WhatsApp via a provider using the stored notification bodies, reschedule endpoint, mentor time-off exceptions, subject/language matching, waitlist with auto-offer on cancellation, slot cache for larger mentor pools, observability (metrics on "no availability" rate per zone/day to drive mentor shift planning).
