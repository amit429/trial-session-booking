# Technical Design: Trial-Class Booking

| | |
|---|---|
| Status | Ready for implementation |
| Last updated | 2026-10-08 |
| Related | [PRD](./PRD.md) |

**Contents:** 1 Overview · 2 Architecture · 3 Repository layout · 4 Technology · 5 Decisions (ADRs) · 6 Data model · 7 Time module · 8 Slot engine · 9 Booking · 10 API · 11 Frontend · 12 Design system · 13 Config & local setup · 14 Seed data · 15 Testing · 16 Implementation milestones · 17 Traceability · 18 Future work

---

## 1. Overview

A React SPA talks to a Node.js (Express, TypeScript) REST API backed by PostgreSQL.

- **Free slots are computed on each request** from mentor shifts, confirmed bookings and the daily cap. There is no slots table.
- **Reasonable hours** = parent window (08:00–21:00 parent-local, per date) **and** the mentor's own shift.
- **Booking correctness** (no overlap, ≤ 2 trials per mentor per IST date, idempotency, one active trial per parent) comes from a **short locking transaction plus database constraints**.
- **Suggestions** are computed from the same slot list, using a 4-step cascade.

## 2. Architecture

```
┌──────────── apps/web (Vite + React + TS) ────────────┐
│ routes → feature components → hooks (TanStack Query) │
│ → api client (fetch + zod-parsed responses)          │
└───────────────────────┬──────────────────────────────┘
                        │ JSON / REST   /api/*   (Vite dev proxy → :4000)
┌───────────────────────▼──────── apps/api (Express + TS) ──────────┐
│ routes → controllers (zod validation, HTTP mapping)               │
│        → services: SlotService, SuggestionService, BookingService, │
│          AssignmentStrategy, NotificationService, CalendarService  │
│        → repositories (Prisma)   ← Clock, Config, Logger (DI)      │
│ domain: pure functions (slot engine, suggestion ranking)           │
└───────────────────────┬───────────────────────────────────────────┘
                        │ Prisma (+ raw SQL for locks / constraints)
                 ┌──────▼──────┐
                 │ PostgreSQL  │   docker-compose: dev :5432, test :5433
                 └─────────────┘
packages/shared: zod schemas, DTO types, error codes, time module (Luxon)
```

**Layering rules**

1. Controllers: parse + validate input, call one service, map result/error to HTTP. No business logic.
2. Services: business rules. Depend on repository interfaces, `Clock`, `Config`. No Express types.
3. Domain + `shared/time`: pure functions, no I/O. Most unit tests live here.
4. Repositories: the only code that touches Prisma.
5. `container.ts`: the single composition root (manual DI). Tests inject `FixedClock` and the test DB.

## 3. Repository layout

```
.
├── docker-compose.yml               # postgres dev (5432) + test (5433)
├── package.json                     # npm workspaces, root scripts
├── .env.example
├── README.md  TRANSCRIPT.md
├── docs/  PRD.md  TECHNICAL_DESIGN.md  API.md
├── packages/shared/src/
│   ├── index.ts
│   ├── schemas/  booking.ts slots.ts mentor.ts common.ts   # zod request/response schemas
│   ├── errors.ts                                           # ErrorCode enum + user-facing messages
│   └── time/
│       ├── zones.ts        normalizeZone, PINNED_ZONES, zone label map
│       ├── windows.ts      localDayWindow, dayWindow, localClockMinutes, mentorLocalDate
│       ├── grid.ts         gridStarts
│       ├── rules.ts        expandRules
│       ├── format.ts       formatSlot, formatZoneLabel, zoneAbbreviation, timeOfDayGroup
│       └── transitions.ts  upcomingTransitions
├── apps/api/
│   ├── prisma/  schema.prisma  migrations/  seed.ts
│   ├── src/
│   │   ├── server.ts  app.ts  container.ts
│   │   ├── config.ts              # zod-parsed env
│   │   ├── clock.ts               # Clock, SystemClock, FixedClock
│   │   ├── http/  errors.ts (AppError, error middleware)  rateLimit.ts  idempotency.ts
│   │   ├── routes/  slots.ts bookings.ts mentors.ts health.ts
│   │   ├── controllers/  (one per route file)
│   │   ├── services/  slotService.ts suggestionService.ts bookingService.ts
│   │   │              assignmentStrategy.ts notificationService.ts calendarService.ts
│   │   ├── domain/  slotEngine.ts  suggestions.ts  reference.ts
│   │   └── repositories/  mentorRepo.ts bookingRepo.ts parentRepo.ts
│   └── test/  unit/  integration/  helpers/ (db reset, factories, FixedClock)
└── apps/web/src/
    ├── main.tsx  app/ (router.tsx, queryClient.ts, Layout.tsx)
    ├── components/ui/                 # shadcn primitives
    ├── lib/  api.ts  useTimezone.ts  idempotencyKey.ts
    └── features/
        ├── booking/       BookPage TimezoneBar DstBanner DayStrip SlotGrid SlotButton
        │                  BookingForm SelectedSlotCard SuggestionsPanel
        ├── confirmation/  ConfirmationPage ConfirmationCard AddToCalendar CopyLink
        ├── manage/        ManagePage LookupForm CancelDialog
        └── mentor/        MentorPage MentorPicker MentorAgenda CapacityMeter
```

## 4. Technology

| Concern | Choice | Version guidance | Reason |
|---|---|---|---|
| Language | TypeScript (strict) | 5.x | Shared types across web/api |
| Frontend | React + Vite | React 18, Vite 5 | Required stack; fast dev |
| Routing | react-router | 6.x | Simple SPA routes |
| Server state | TanStack Query | 5.x | Caching, refetch on focus, mutation states |
| Forms | react-hook-form + @hookform/resolvers + zod | latest | One schema for client + server |
| UI | Tailwind CSS + shadcn/ui (Radix) + lucide-react + sonner | Tailwind 3.x | Accessible primitives, we own the code |
| Backend | Express | 4.x | Small, well known |
| DB / ORM | PostgreSQL 16 + Prisma | Prisma 5.x | Transactions, locks, constraints; typed client |
| Time | Luxon | 3.x | IANA zones, DST-aware arithmetic |
| Misc API | pino + pino-http, helmet, cors, express-rate-limit, nanoid, ics | latest | Logging, security, ids, calendar files |
| Tests | Vitest, supertest, @testing-library/react, fast-check | latest | One runner; property tests for windows |

## 5. Decisions (ADRs)

| # | Decision | Why | Revisit when |
|---|---|---|---|
| ADR-1 | **PostgreSQL** (Docker locally; same URL works for Supabase/Neon) over Firebase/SQLite | `FOR UPDATE`, partial indexes, **`EXCLUDE USING gist`** make double-booking impossible at the storage level. Firestore has no relational constraints; SQLite lacks exclusion constraints and row locks | — |
| ADR-2 | **Compute slots from shifts**; no slots table | Availability = shifts − bookings − capped mentors. A stored slots table duplicates state, needs regeneration, drifts, and still can't enforce the daily cap. 10 mentors × 14 days = a few thousand in-memory checks after 2 queries | Hundreds of mentors → per-day cache |
| ADR-3 | **No soft holds** during checkout | Holds need expiry jobs. The atomic final check + suggestions handle the rare race | Collision rate becomes noticeable |
| ADR-4 | **Daily cap counts on the mentor's local (IST) date** | It's about the mentor's workload. `mentorLocalDate` stored on the booking → simple indexed count. Shifts don't cross IST midnight | A shift needs to cross midnight → count per "shift day" |
| ADR-5 | **UTC instants + IANA zone names**; never offsets | DST-safe; bookings snapshot both zones | — |
| ADR-6 | **Reasonable hours = parent window + mentor shift; no global IST cap** | Industry practice (Codeyoung US shift 2:30–7:30 AM IST; Cuemath 12–7 AM IST) and Calendly/Cal.com model. A global 08–22 IST cap left US East/Central with mornings only. Both rules evaluated per local date → DST automatic; enforced in slot generation **and** booking | — |
| ADR-7 | **Show Full slots, hide unstaffed times** | Explains why a time isn't bookable; entry point to suggestions. Unstaffed times would look broken if shown | — |
| ADR-8 | **One short transaction per candidate mentor** | Holds ≤ 1 parent lock + 1 mentor lock, always in that order → no deadlocks (one long tx walking candidates could deadlock if two requests rank mentors differently) | — |
| ADR-9 | **30-min grid in UTC** | US/UK/IE/IN offsets are multiples of 30 min → every target user sees :00/:30. :45-offset zones still correct (:15/:45 times) | — |

## 6. Data model

### 6.1 Prisma schema

```prisma
generator client { provider = "prisma-client-js" }
datasource db   { provider = "postgresql"  url = env("DATABASE_URL") }

enum Subject       { CODING MATH }
enum BookingStatus { CONFIRMED CANCELLED }
enum RecipientType { PARENT MENTOR }

model Mentor {
  id             String             @id @default(uuid()) @db.Uuid
  name           String
  email          String             @unique
  timezone       String             // IANA, e.g. Asia/Kolkata
  bio            String
  shiftLabel     String             // "UK shift", "US-East shift", "US-West shift" (display only)
  maxDailyTrials Int                @default(2)
  isActive       Boolean            @default(true)
  createdAt      DateTime           @default(now()) @db.Timestamptz(3)
  rules          AvailabilityRule[]
  bookings       Booking[]
}

model AvailabilityRule {               // one row = one shift block on one weekday
  id          String @id @default(uuid()) @db.Uuid
  mentorId    String @db.Uuid
  weekday     Int    // 1 = Mon … 7 = Sun, in the mentor's zone
  startMinute Int    // minutes since local midnight, e.g. 30 = 00:30
  endMinute   Int    // exclusive, ≤ 1440
  mentor      Mentor @relation(fields: [mentorId], references: [id], onDelete: Cascade)
  @@index([mentorId])
}

model Parent {
  id        String    @id @default(uuid()) @db.Uuid
  name      String
  email     String    @unique            // stored lowercased + trimmed
  phone     String?
  timezone  String                       // last used IANA zone
  createdAt DateTime  @default(now()) @db.Timestamptz(3)
  bookings  Booking[]
}

model Booking {
  id              String         @id @default(uuid()) @db.Uuid
  reference       String         @unique          // CY-XXXXXX
  parentId        String         @db.Uuid
  mentorId        String         @db.Uuid
  childName       String
  childGrade      Int
  subject         Subject
  startUtc        DateTime       @db.Timestamptz(3)
  endUtc          DateTime       @db.Timestamptz(3)
  mentorLocalDate DateTime       @db.Date         // capacity key
  parentTimezone  String                           // snapshot
  mentorTimezone  String                           // snapshot
  meetingUrl      String
  status          BookingStatus  @default(CONFIRMED)
  cancelledAt     DateTime?      @db.Timestamptz(3)
  idempotencyKey  String         @unique
  createdAt       DateTime       @default(now()) @db.Timestamptz(3)
  updatedAt       DateTime       @updatedAt @db.Timestamptz(3)
  parent          Parent         @relation(fields: [parentId], references: [id])
  mentor          Mentor         @relation(fields: [mentorId], references: [id])
  notifications   Notification[]
  @@index([startUtc])
  @@index([parentId, status])
}

model Notification {
  id            String        @id @default(uuid()) @db.Uuid
  bookingId     String        @db.Uuid
  recipientType RecipientType
  timezone      String
  subject       String
  body          String
  createdAt     DateTime      @default(now()) @db.Timestamptz(3)
  booking       Booking       @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  @@index([bookingId])
}
```

### 6.2 Constraints (hand-written SQL migration after the Prisma one)

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Booking"
  ADD CONSTRAINT booking_time_valid CHECK ("endUtc" > "startUtc"),
  ADD CONSTRAINT booking_grade_valid CHECK ("childGrade" BETWEEN 1 AND 12),
  ADD CONSTRAINT booking_no_overlap_per_mentor
    EXCLUDE USING gist ("mentorId" WITH =, tstzrange("startUtc", "endUtc", '[)') WITH &&)
    WHERE (status = 'CONFIRMED');

CREATE INDEX booking_mentor_day_confirmed
  ON "Booking" ("mentorId", "mentorLocalDate") WHERE status = 'CONFIRMED';

ALTER TABLE "AvailabilityRule"
  ADD CONSTRAINT rule_weekday CHECK (weekday BETWEEN 1 AND 7),
  ADD CONSTRAINT rule_bounds  CHECK ("startMinute" >= 0 AND "startMinute" < "endMinute" AND "endMinute" <= 1440);
```

- Rules can't span midnight (a 22:00–01:00 shift = two rows). Seeded shifts don't cross midnight at all (ADR-4).
- The **daily cap** isn't a DB constraint (it depends on a count). It's enforced inside the locked transaction (§9), where the mentor row lock serializes all writers for that mentor.

## 7. Time module (`packages/shared/src/time`)

All functions are pure and take explicit zones; none read the system zone.

| Function | Signature | Behaviour |
|---|---|---|
| `normalizeZone` | `(zone: string) => string` | Accepts IANA names and aliases (`Asia/Calcutta` → `Asia/Kolkata`, `US/Eastern` → `America/New_York`); throws `InvalidZoneError` otherwise. Uses `IANAZone.isValidZone` plus a small alias map |
| `localDayWindow` | `(date: ISODate, zone) => Interval(UTC)` | `[startOf('day'), startOf('day') + {days:1})`; 23 h / 25 h on DST days |
| `dayWindow` | `(date, zone, startMin, endMin) => Interval(UTC)` | e.g. 08:00–21:00 on that local date. Built from `DateTime.fromObject({...date, hour, minute}, {zone})` per date |
| `localClockMinutes` | `(instant, zone) => number` | Minutes since local midnight |
| `localDate` | `(instant, zone) => ISODate` | e.g. capacity key `mentorLocalDate` |
| `gridStarts` | `(interval, stepMin) => Instant[]` | UTC instants aligned to `stepMin` since the epoch |
| `expandRules` | `(rules, zone, interval) => Interval[]` | For every local date touching `interval` (±1 day), each rule on that weekday → UTC interval. Non-existent local times shift forward (Luxon default) |
| `zoneAbbreviation` | `(zone, instant) => string` | Override map first (`Europe/London` → BST/GMT, `Europe/Dublin` → GMT+1/GMT, `Asia/Kolkata` → "IST (India)"), else `Intl` short name |
| `formatZoneLabel` | `(zone, instant) => string` | Long name + offset: "Eastern Time (UTC−04:00)", "UK time (UTC+01:00)", "Irish time (UTC+01:00)", "India Standard Time (UTC+05:30)" |
| `formatSlot` | `(instant, zone) => string` | `Sat 31 Oct · 8:30 AM EDT` |
| `timeOfDayGroup` | `(instant, zone) => 'morning'\|'afternoon'\|'evening'` | < 12:00, < 17:00, else |
| `upcomingTransitions` | `(zone, interval) => {atUtc, fromOffset, toOffset}[]` | Scans offsets per hour; returns changes |

`PINNED_ZONES` (picker order): America/New_York, America/Chicago, America/Denver, America/Phoenix, America/Los_Angeles, America/Anchorage, Pacific/Honolulu, Europe/London, Europe/Dublin, Asia/Kolkata.

## 8. Slot engine

### 8.1 Rules every offered slot satisfies

For a candidate class `c = [s, s + 60 min)`:

| Rule | Check |
|---|---|
| Grid | `s` aligned to 30 min |
| Notice / horizon | `now + MIN_NOTICE ≤ s` and `s < startOf(today_parent) + HORIZON days` |
| Parent window | `c ⊆ dayWindow(localDate(s, parentTz), parentTz, PARENT_HOURS_START, PARENT_HOURS_END)` |
| Staffed by m | `c ⊆` one of m's expanded shift intervals |
| Free for m | no CONFIRMED booking of m overlapping `c` |
| Under cap for m | `count(CONFIRMED of m on localDate(s, m.timezone)) < m.maxDailyTrials` |

`staffed(c)` = mentors passing *Staffed*. `available(c)` = staffed mentors also passing *Free* and *Under cap*.

### 8.2 `buildSlots` (pure, `domain/slotEngine.ts`)

```
input:  parentTz, fromDate, days, now, config, mentors(with rules), bookings(CONFIRMED in range ±1 day)
output: { days: DaySlots[], transitions }

for each mentor m:
    shifts[m]  = expandRules(m.rules, m.timezone, range ± 1 day)
    busy[m]    = bookings of m as intervals
    count[m]   = map mentorLocalDate → number of bookings
for each local date d in [fromDate, fromDate + days):
    win = dayWindow(d, parentTz, PARENT_START, PARENT_END)
    slots = []
    for s in gridStarts(win, STEP) where s + DURATION ≤ win.end and notice/horizon ok:
        staffed   = mentors with c ⊆ some shift
        if staffed is empty: continue                       -- not shown (ADR-7)
        available = staffed.filter(free && underCap)
        slots.push({ startUtc: s, endUtc: s+60, status: available ? OPEN : FULL,
                     availableMentors: available.length })
    day.status = slots.some(OPEN) ? OPEN : slots.length ? FULL : CLOSED
```

`SlotService.getSlots(tz, from, days)` loads data with **2 queries** and calls `buildSlots`. The same function powers suggestions and the booking pre-check, so all three always agree.

### 8.3 Suggestion cascade (pure, `domain/suggestions.ts`)

```
rankSuggestions(daysSlots, D, T, parentTz, limits) →
  open(d)         = Open slots on day d
  dist(slot)      = |localClockMinutes(slot) − T|

  1. SAME_DAY   if open(D) non-empty:
       sort open(D) by dist asc, then start asc; take limits.sameDay (4)
  2. SAME_TIME  else: days d ≠ D with an Open slot where localClockMinutes == T;
       sort by |d − D| asc, then later day first; take limits.sameTime (3)
       notes: if transitions in range and "T is staffed" flips across a transition,
              add { type: 'DST_SHIFT', fromDate, message }
  3. NEAREST    else: days ascending from today; per day take ≤ 2 Open slots by dist asc;
       stop at limits.nearest (4)
  4. NONE       else
returns { strategy, requested: { date: D, time: T, timezone }, suggestions: Slot[], notes }
```

`SuggestionService.suggest(tz, D, T)` = `getSlots(tz, today, HORIZON)` → `rankSuggestions`. Used by `GET /slots/suggestions` and embedded in 409/422 booking errors.

## 9. Booking

### 9.1 Algorithm (`BookingService.create`)

```
POST /api/bookings   Idempotency-Key: <uuid v4>

1. existing = bookingRepo.findByIdempotencyKey(key) → if found return 201 with it
2. Validate body (shared zod schema); tz = normalizeZone(body.timezone)
3. Pre-check with buildSlots for that single instant:
     off grid / beyond horizon  → 422 VALIDATION
     < now + notice             → 422 SLOT_TOO_SOON (+ suggestions)
     outside parent window or no staffed mentor → 422 OUTSIDE_HOURS (+ suggestions)
4. candidates = AssignmentStrategy.rank(available mentors for the slot)
   (empty → go to 6)
5. for m in candidates:                                   -- one SHORT tx each (ADR-8)
     prisma.$transaction:
       parent = upsert Parent by email (update name/phone/timezone)
       SELECT id FROM "Parent" WHERE id = $parent FOR UPDATE
       if exists CONFIRMED booking for parent with startUtc > now
            → throw ACTIVE_TRIAL_EXISTS (409, details: { reference, startUtc })
       SELECT id FROM "Mentor" WHERE id = $m FOR UPDATE
       overlap  = exists CONFIRMED booking of m overlapping [start, end)
       dayCount = count CONFIRMED of m where mentorLocalDate = localDate(start, m.tz)
       if overlap or dayCount ≥ m.maxDailyTrials → rollback, continue
       insert Booking { reference, meetingUrl, snapshots, mentorLocalDate, idempotencyKey }
            23P01 exclusion → rollback, continue
            23505 on reference → regenerate (max 3), retry insert
            23505 on idempotencyKey → rollback; return the existing booking (concurrent duplicate)
       insert 2 Notifications (NotificationService.render for parent tz and mentor tz)
     → 201 BookingDto
6. → 409 SLOT_UNAVAILABLE (+ suggestions for D = localDate(start, tz), T = localClockMinutes(start, tz))
```

**Why it is safe**

- Writers for the same mentor serialize on the mentor row lock and re-read committed state.
- The exclusion constraint rejects any overlap even if application logic is wrong.
- Each tx holds ≤ 1 parent lock + 1 mentor lock, always Parent → Mentor, so no deadlock cycle.
- Same-parent tabs serialize on the parent lock, so the active-trial check is race-free.
- Idempotency key is unique: a replay or concurrent duplicate returns the same booking.

### 9.2 AssignmentStrategy

Interface `rank(slot, availableMentors, context) → Mentor[]`. Default `BalancedAssignment` sorts by:

1. **fewest CONFIRMED trials on that IST date** (spread load fairly);
2. **fewest other Open slots that IST date where this mentor is available** (scarcity-aware: keep flexible mentors free for times only they can cover);
3. **mentor id** ascending (deterministic).

### 9.3 Validation rules (shared zod schema `CreateBookingRequest`)

| Field | Rule | Message |
|---|---|---|
| `parent.name` | trim, 2–80 chars | "Please enter your name" |
| `parent.email` | trim, lowercase, valid email, ≤ 254 | "Please enter a valid email" |
| `parent.phone` | optional; `^\+?[0-9 ()-]{7,20}$` | "Please enter a valid phone number" |
| `child.name` | trim, 1–60 | "Please enter your child's name" |
| `child.grade` | integer 1–12 | "Choose a grade between 1 and 12" |
| `subject` | `CODING` \| `MATH` | "Choose a subject" |
| `startUtc` | ISO-8601 with `Z`, seconds = 0, minutes ∈ {0, 30} | "Please pick a time from the list" |
| `timezone` | `normalizeZone` succeeds | "Please choose your time zone" |
| header `Idempotency-Key` | UUID v4, required | 400 `VALIDATION` |

### 9.4 Generated values

- `reference`: `CY-` + 6 chars from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (nanoid `customAlphabet`).
- `meetingUrl`: `${MEETING_BASE_URL}/${reference}-${nanoid(10)}`.
- Notification bodies (rendered with `formatSlot` in the recipient's zone):
  - Parent: "Your free {Subject} trial for {child} is confirmed for {Sat 31 Oct · 3:00 PM EDT} with {mentor}. Join: {link}".
  - Mentor: "New trial: {child} (Grade {g}, {Subject}) on {Sun 1 Nov · 12:30 AM IST (India)}. Parent's time: {Sat 31 Oct · 3:00 PM EDT}. Join: {link}".

### 9.5 Cancel

`POST /bookings/:ref/cancel {email}`: find by reference + lowercased email (else 404); if `startUtc ≤ now` → 422 `ALREADY_STARTED`; if already CANCELLED → 200 same booking; else set `status=CANCELLED, cancelledAt=now`. Capacity frees automatically: every count and the exclusion constraint only consider CONFIRMED.

## 10. API

Base `/api`. JSON. All instants are ISO-8601 UTC strings. Error envelope:

```json
{ "error": { "code": "SLOT_UNAVAILABLE", "message": "That time was just booked.", "details": { } } }
```

### 10.1 Endpoints

| Method | Path | Success | Errors |
|---|---|---|---|
| GET | `/health` | 200 `{ status: "ok", db: "ok" }` | 503 |
| GET | `/slots?tz&from&days` | 200 `SlotsResponse` | 422 |
| GET | `/slots/suggestions?tz&date&time` | 200 `SuggestionsResponse` | 422 |
| POST | `/bookings` (header `Idempotency-Key`) | 201 `BookingDto` | 409, 422, 429 |
| GET | `/bookings/:reference?email` | 200 `BookingDto` | 404 |
| POST | `/bookings/:reference/cancel` `{ email }` | 200 `BookingDto` | 404, 422 |
| GET | `/bookings/:reference/calendar.ics?email` | 200 `text/calendar` | 404 |
| GET | `/mentors` | 200 `MentorDto[]` | — |
| GET | `/mentors/:id/agenda?from&days` | 200 `MentorAgendaDto` | 404, 422 |

Defaults: `from` = today in `tz` (or IST for agenda), `days` = 14 (max 14). `time` = `HH:mm` with minutes 00/30.

### 10.2 Error codes

| Code | HTTP | When | `details` | UI |
|---|---|---|---|---|
| `VALIDATION` | 400 / 422 | Bad header / body / query | `{ fieldErrors }` | Inline field errors |
| `SLOT_TOO_SOON` | 422 | Start < now + notice | `{ suggestions }` | SuggestionsPanel, "This time is now too soon to book." |
| `OUTSIDE_HOURS` | 422 | Outside parent window or no mentor shift | `{ suggestions }` | SuggestionsPanel |
| `SLOT_UNAVAILABLE` | 409 | No candidate mentor succeeded | `{ suggestions }` | SuggestionsPanel, "That time was just booked." |
| `ACTIVE_TRIAL_EXISTS` | 409 | Parent has an upcoming CONFIRMED trial | `{ reference, startUtc, timezone }` | "You already have a trial…" + View booking |
| `NOT_FOUND` | 404 | Unknown reference/email pair, unknown mentor | — | "We couldn't find a booking with those details." |
| `ALREADY_STARTED` | 422 | Cancel after start | — | "This class has already started…" |
| `RATE_LIMITED` | 429 | > 10 booking POSTs/min/IP | — | Toast "Too many attempts, try again in a minute." |
| `INTERNAL` | 500 | Unexpected | — (logged with request id) | Toast "Something went wrong. Please try again." |

### 10.3 Examples

`GET /api/slots?tz=America/New_York&from=2026-10-20&days=1`

```json
{
  "timezone": "America/New_York",
  "meta": { "horizonDays": 14, "minNoticeMinutes": 120, "classDurationMinutes": 60 },
  "days": [{
    "date": "2026-10-20",
    "status": "OPEN",
    "slots": [
      { "startUtc": "2026-10-20T19:00:00.000Z", "endUtc": "2026-10-20T20:00:00.000Z", "status": "OPEN", "availableMentors": 3 },
      { "startUtc": "2026-10-20T19:30:00.000Z", "endUtc": "2026-10-20T20:30:00.000Z", "status": "FULL", "availableMentors": 0 }
    ]
  }],
  "transitions": []
}
```

`POST /api/bookings`

```json
{
  "parent":  { "name": "Jane Doe", "email": "jane@example.com", "phone": "+1 555 010 2000" },
  "child":   { "name": "Sam", "grade": 4 },
  "subject": "CODING",
  "startUtc": "2026-10-20T19:00:00.000Z",
  "timezone": "America/New_York"
}
```

`201 Created`

```json
{
  "reference": "CY-7K3P9Q",
  "status": "CONFIRMED",
  "startUtc": "2026-10-20T19:00:00.000Z",
  "endUtc": "2026-10-20T20:00:00.000Z",
  "parentTimezone": "America/New_York",
  "mentorTimezone": "Asia/Kolkata",
  "meetingUrl": "https://meet.codeyoung-demo.com/trial/CY-7K3P9Q-x8Jd02LmQa",
  "child": { "name": "Sam", "grade": 4 },
  "subject": "CODING",
  "mentor": { "id": "…", "name": "Vikram Nair", "bio": "…", "shiftLabel": "US-East shift" },
  "googleCalendarUrl": "https://calendar.google.com/calendar/render?action=TEMPLATE&…"
}
```

`409 Conflict`

```json
{ "error": { "code": "SLOT_UNAVAILABLE", "message": "That time was just booked.",
  "details": { "suggestions": {
    "strategy": "SAME_DAY",
    "requested": { "date": "2026-10-20", "time": "15:00", "timezone": "America/New_York" },
    "suggestions": [ { "startUtc": "2026-10-20T19:30:00.000Z", "endUtc": "…", "status": "OPEN", "availableMentors": 1 } ],
    "notes": []
  } } } }
```

Full examples for every endpoint go in `docs/API.md`.

### 10.4 Cross-cutting

- `helmet`, `cors({ origin: CORS_ORIGIN })`, `express.json({ limit: '10kb' })`.
- `pino-http` with a request id. The error middleware maps `AppError` → envelope and everything else → `INTERNAL` (no stack traces).
- Rate limit only on `POST /bookings`.

## 11. Frontend

### 11.1 Routes

| Path | Page | Data |
|---|---|---|
| `/` | redirect → `/book` | — |
| `/book` | `BookPage` (2 steps) | `useSlots(tz, from, 14)`, `useCreateBooking()` |
| `/booking/:reference?email=` | `ConfirmationPage` | `useBooking(ref, email)`. Email comes from navigation state or the query string |
| `/manage` | `ManagePage` | `useBooking`, `useCancelBooking` |
| `/mentor` | `MentorPage` | `useMentors()`, `useMentorAgenda(id)` |

### 11.2 Booking page state machine

```
selectTime ──open slot──▶ details ──submit──▶ submitting
   │   ▲                    ▲  │                 ├─ 201 → navigate /booking/:ref
   │   └──── change time ───┘  │                 ├─ 409 SLOT_UNAVAILABLE / 422 SLOT_TOO_SOON|OUTSIDE_HOURS
   │                           │                 │      → details + SuggestionsPanel (form kept)
   │ full slot / full day      └─ pick suggestion┤
   └──▶ SuggestionsPanel (GET /slots/suggestions)└─ 409 ACTIVE_TRIAL_EXISTS → existing-booking card
```

- An idempotency key is generated when entering `details` and regenerated when the slot changes. It is reused on retries of the same submit.
- Slots query: `staleTime` 30 s, refetch on window focus. Invalidated after any booking error.
- Time zone: `useTimezone()` = localStorage → `Intl…resolvedOptions().timeZone` → normalised; null → picker opens.

### 11.3 Components

| Component | Responsibility |
|---|---|
| `TimezoneBar` | "Times shown in Eastern Time (UTC−04:00)" + Change (Radix combobox, `PINNED_ZONES` first, then `Intl.supportedValuesOf('timeZone')`) |
| `DstBanner` | Renders when `transitions.length > 0` (PRD FR-14 copy) |
| `DayStrip` | 14 pills: weekday + date; badge Open (≥ 3 open), Few left (1–2), Full, No classes |
| `SlotGrid` | Groups by `timeOfDayGroup`; roving tabindex; arrow-key navigation |
| `SlotButton` | OPEN: selectable. FULL: muted + "Full" tag, `aria-label="… Full, show other times"`, opens suggestions |
| `SelectedSlotCard` | Pinned summary of the chosen slot + "Change" |
| `BookingForm` | react-hook-form + shared schema; submit button shows "Booking…" |
| `SuggestionsPanel` | Headline per strategy (PRD §8), notes, suggestion buttons (`formatSlot`), step 4 empty state |
| `ConfirmationCard` | Local time (large), India time, current-zone time if different, mentor card, `CopyLink`, `AddToCalendar` (.ics link + Google URL), reference, Cancel |
| `MentorAgenda` | Groups by IST date; `CapacityMeter` `n / max`; each item shows child, subject, parent's local time, link; notifications list |

## 12. Design system

- **Base:** Tailwind CSS + shadcn/ui (Radix primitives). Accessible by default; components live in our repo; themed through CSS variables.
- **Tokens:**

| Token | Value | Use |
|---|---|---|
| `--primary` | violet `#6D28D9` | Buttons, selected slot |
| `--accent` | yellow `#FACC15` | Highlights, "Few left" |
| `--success` | `#16A34A` | Open badge, confirmation |
| `--warning` | `#D97706` | DST banner |
| `--destructive` | `#DC2626` | Errors, cancel |
| neutrals | Tailwind slate | Text, borders, Full slots (`slate-200` bg, `slate-500` text) |
| radius | 12 px | Cards, buttons |
| spacing | 4 px scale | — |
| font | Plus Jakarta Sans → `system-ui` | 16 px base; `tabular-nums` for times |

- **Feedback:** sonner toasts; lucide icons.
- **Not chosen:** MUI / Ant Design (heavier, harder to give a friendly consumer look).

## 13. Configuration and local setup

| Variable | Default | Meaning |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/codeyoung` | Dev DB |
| `TEST_DATABASE_URL` | `postgresql://postgres:postgres@localhost:5433/codeyoung_test` | Integration tests |
| `PORT` | `4000` | API port |
| `CORS_ORIGIN` | `http://localhost:5173` | Web origin |
| `MIN_NOTICE_MINUTES` | `120` | Earliest bookable offset |
| `BOOKING_HORIZON_DAYS` | `14` | Days shown/bookable (set 30 to see the Nov 1 DST change live) |
| `SLOT_STEP_MINUTES` | `30` | Grid step |
| `CLASS_DURATION_MINUTES` | `60` | Trial length |
| `DEFAULT_MAX_DAILY_TRIALS` | `2` | Per-mentor cap per IST date |
| `PARENT_HOURS_START` / `PARENT_HOURS_END` | `08:00` / `21:00` | Parent window |
| `SUGGESTIONS_SAME_DAY` / `_SAME_TIME` / `_NEAREST` | `4` / `3` / `4` | Suggestion limits |
| `MEETING_BASE_URL` | `https://meet.codeyoung-demo.com/trial` | Dummy link base |

Env is parsed with zod on boot; invalid values exit with a clear message.

**Root scripts:** `dev` (api + web concurrently), `build`, `test` (all workspaces), `test:unit`, `test:integration`, `db:up` (`docker compose up -d`), `db:migrate`, `db:seed`, `db:reset`, `lint`, `typecheck`.

## 14. Seed data (`apps/api/prisma/seed.ts`)

**Mentors** (all `Asia/Kolkata`, `maxDailyTrials = 2`; weekday off is in IST):

| # | Name | Shift | IST hours | Day off |
|---|---|---|---|---|
| 1 | Aarav Sharma | UK shift | 13:00–23:30 | Mon |
| 2 | Priya Iyer | UK shift | 13:00–23:30 | Wed |
| 3 | Rohan Mehta | UK shift | 13:00–23:30 | Fri |
| 4 | Ananya Reddy | UK shift | 13:00–23:30 | Sun |
| 5 | Vikram Nair | US-East shift | 00:30–07:30 | Tue |
| 6 | Sneha Kulkarni | US-East shift | 00:30–07:30 | Thu |
| 7 | Arjun Desai | US-East shift | 00:30–07:30 | Sat |
| 8 | Kavya Menon | US-East shift | 00:30–07:30 | Sun |
| 9 | Ishaan Gupta | US-West shift | 03:30–09:30 | Mon |
| 10 | Meera Pillai | US-West shift | 03:30–09:30 | Fri |

Each mentor gets one `AvailabilityRule` per working weekday. Note: an IST Saturday 00:30–07:30 US-East shift is US **Friday** evening.

**Bookings** are created **through `BookingService` with a `FixedClock` = real now**, so every invariant holds. Dates are relative to today (parent-local `America/New_York` unless stated):

| Scenario | How | Shows |
|---|---|---|
| S1 Mentor at cap | 2 bookings for Aarav on tomorrow's IST date | Capacity meter 2/2; Aarav absent from other slots that day |
| S2 Full slot | Day + 2, 9:30 AM EDT (19:00 IST): book until no mentor is available | Full slot → suggestions step 1 |
| S3 Full day | Day + 4: book each Open slot of that New York date until the day has none | Full day → suggestions step 2 |
| S4 Cancelled | One booking on day + 5, then cancelled | Cancelled state in `/manage`; slot is open |

Seed parents: `parent1@example.com`, `parent2@example.com`, … (one per booking, because of the one-active-trial rule). The script prints the references for S1–S4.

## 15. Testing

| Level | Location | Must cover |
|---|---|---|
| **Unit: time** | `packages/shared` | DST day lengths (NY 2026-11-01 = 25 h, 2027-03-14 = 23 h); T1 conversions (18:00 IST → 1:30 PM BST / 12:30 PM GMT; 8:30 AM EDT / 7:30 AM EST); Phoenix and Kolkata unchanged; aliases normalised; Dublin/Kolkata/London labels (never bare "IST", London = BST not GMT+1); repeated-hour labels (T3); `expandRules` across date boundaries and a spring-forward gap (T4) |
| **Unit: slot engine** | `apps/api/test/unit` | PRD §7.3 table as fixtures on 20 Oct and 10 Nov 2026 for every listed zone; **property test** (fast-check, all pinned zones × 60 days × random bookings): no slot outside the parent window, every OPEN slot has a mentor whose shift covers it, no FULL slot with 0 staffed; cap and overlap rules; notice/horizon |
| **Unit: suggestions** | same | Each strategy: SAME_DAY ordering and ties; full day → SAME_TIME with nearest days; same local 9:00 AM before/after 1 Nov → different UTC; DST note emitted; NEAREST ≤ 2/day and ≤ 4 total; NONE |
| **Unit: assignment** | same | Ranking by daily load, then scarcity, then id |
| **Integration** | `apps/api/test/integration` (real Postgres on :5433, `FixedClock`, DB truncated per test) | Happy path + notifications in both zones; 2/day cap; `OUTSIDE_HOURS` for a 3 AM request; `SLOT_TOO_SOON`; 409 includes suggestions; **10 concurrent POSTs with one free mentor → exactly 1 × 201, 9 × 409**; **30 parallel bookings over a day → no mentor > 2/IST date, no overlaps**; idempotent replay (sequential and concurrent); active-trial rule (incl. two tabs at once); cancel frees capacity and is idempotent; direct SQL overlapping insert fails with `23P01`; lookup with wrong email → 404 |
| **Frontend** | `apps/web` (RTL + mocked API) | Slots render in chosen zone with abbreviations; Full slots greyed and open suggestions; each strategy's headline; form validation messages; 409 flow keeps form data; DST banner |
| **E2E (optional)** | Playwright | Book → confirmation → mentor view shows the same trial in India time |

## 16. Implementation milestones

Each milestone ends with green tests and one commit.

| M | Deliverable | Done when |
|---|---|---|
| M0 | Workspaces, TS/ESLint/Prettier, docker-compose, `.env.example`, root scripts | `npm run db:up && npm run typecheck` pass |
| M1 | `packages/shared`: time module + zod schemas + error codes (**tests first**) | Unit: time suite green |
| M2 | Prisma schema, SQL constraints migration, repositories | `db:migrate` works; `23P01` integration test green |
| M3 | API skeleton: config, clock, logger, error middleware, container, `/health` | `/health` returns ok; error envelope test green |
| M4 | Slot engine + `SlotService` + `GET /slots` | Slot engine unit + property tests green; §7.3 fixtures match |
| M5 | Suggestions + `GET /slots/suggestions` | Suggestion unit tests green |
| M6 | `BookingService`, `AssignmentStrategy`, notifications, `POST /bookings`, lookup, cancel, `.ics`, mentors endpoints | All integration tests, incl. concurrency, green |
| M7 | Seed script (S1–S4) | `db:seed` prints references; states visible via API |
| M8 | Web scaffold: Tailwind + shadcn tokens, router, query client, api client, `useTimezone` | App boots, shows the time-zone bar |
| M9 | Booking flow: DayStrip, SlotGrid, BookingForm, SuggestionsPanel, DstBanner | RTL tests green; manual book works |
| M10 | Confirmation, Manage, Mentor pages | RTL tests green; manual checks pass |
| M11 | Polish: empty/error states, a11y pass, responsive at 360 px | Keyboard-only booking works; no console errors |
| M12 | `README.md`, `docs/API.md`, `TRANSCRIPT.md` | Fresh clone → running app by following README |

## 17. Traceability

| PRD | Implemented in | Tested by |
|---|---|---|
| FR-1, T8 | `useTimezone`, `TimezoneBar`, `normalizeZone` | Unit time; RTL |
| FR-2, FR-3, FR-5 | `slotEngine.buildSlots`, `SlotGrid`, `DayStrip` | Unit slot engine; RTL |
| FR-4, T11, T13, T14 | `dayWindow`, `slotEngine`, `BookingService` pre-check | Property test; §7.3 fixtures; integration `OUTSIDE_HOURS` |
| FR-6 | shared `CreateBookingRequest`, `BookingForm` | RTL; integration `VALIDATION` |
| FR-7, C1–C3, C7, C8 | `BookingService`, `AssignmentStrategy`, SQL constraints | Integration concurrency, idempotency, active-trial |
| FR-8, FR-9 | `ConfirmationCard`, `NotificationService`, `CalendarService` | Integration notifications; RTL |
| FR-10 | `MentorPage`, `/mentors/:id/agenda` | Integration; RTL |
| FR-11, C4, C5, C9, C11 | `suggestions.rankSuggestions`, `SuggestionsPanel` | Unit suggestions; integration 409/422; RTL |
| FR-12, C10 | cancel endpoint, `ManagePage` | Integration cancel |
| FR-13 | parent lock + active check | Integration two-tabs |
| FR-14, T1–T6, T12 | `upcomingTransitions`, `DstBanner`, time module | Unit time; RTL |
| T7, display rules | `zoneAbbreviation`, `formatZoneLabel` | Unit time |

## 18. Future work

Auth (magic links); real email/WhatsApp using stored notification bodies; reschedule endpoint; mentor time-off exceptions; admin UI for shifts; subject/language matching; waitlist with auto-offer on cancellation; per-day slot cache for larger mentor pools; metrics on "no availability" by zone/day to plan mentor shifts.
