# Technical Design: Trial-Class Booking

|              |                          |
| ------------ | ------------------------ |
| Status       | Ready for implementation |
| Last updated | 2026-10-08               |
| Related      | [PRD](./PRD.md)          |

**Contents:** 1 Overview · 2 Architecture · 3 Repository layout · 4 Technology · 5 Decisions (ADRs) · 6 Data model · 7 Time module · 8 Slot engine · 9 Booking · 10 Auth & access · 11 API · 12 Frontend · 13 Design system · 14 Config & local setup · 15 Seed data · 16 Testing · 17 Milestones · 18 Traceability · 19 Future work

---

## 1. Overview

A React SPA talks to a Node.js (Express, TypeScript) REST API backed by PostgreSQL.

- **Free slots are computed on each request** from mentor shifts, confirmed bookings and the daily cap. There is no slots table.
- **Reasonable hours** = parent window (08:00–21:00 parent-local, per date) **and** the mentor's own shift.
- **Booking correctness** (no overlap, ≤ 2 per mentor per IST date, idempotency, one active trial per email) comes from a **short locking transaction plus database constraints**.
- **Suggestions** come from the same slot list via a 4-step cascade.
- **Access:** guest booking with a private per-booking **manage link**; optional **parent accounts** (email + password, email verification) for "My bookings"; a seeded **admin** account for the console. Sessions are our own small DB-backed layer. Outgoing messages go to an **Outbox** table instead of real email.

## 2. Architecture

```
┌──────────── apps/web (Vite + React + TS) ─────────────────────────┐
│ public: /book /booking/:ref  auth: /signup /login /verify-email …  │
│ parent: /my-bookings          admin: /admin/*      dev: /dev/outbox │
│ routes → feature components → hooks (TanStack Query) → api client  │
└───────────────────────┬────────────────────────────────────────────┘
                        │ JSON / REST /api/*  (Vite proxy → same origin; cookies)
┌───────────────────────▼──────── apps/api (Express + TS) ──────────────┐
│ middleware: helmet · json · pino-http · loadSession · originCheck      │
│ routes → controllers (zod validation, HTTP mapping)                    │
│        → services: Slot, Suggestion, Booking, Assignment, Outbox,      │
│                    Calendar, ParentAuth, AdminAuth, Session, Admin      │
│        → repositories (Prisma)   ← Clock, Config, Logger (DI)           │
│ domain: slotEngine, suggestions, reference, tokens (pure)               │
└───────────────────────┬────────────────────────────────────────────────┘
                        │ Prisma (+ raw SQL for locks / constraints)
                 ┌──────▼──────┐
                 │ PostgreSQL  │   docker-compose: dev :5432, test :5433
                 └─────────────┘
packages/shared: zod schemas, DTO types, error codes, time module (Luxon)
```

**Layering rules**

1. Controllers: parse + validate input, call one service, map result/error to HTTP. No business logic.
2. Services: business rules; depend on repository interfaces, `Clock`, `Config`. No Express types.
3. Domain + `shared/time`: pure functions, no I/O. Most unit tests live here.
4. Repositories: the only code that touches Prisma.
5. Authorization happens in **middleware (role)** and **services (ownership)**, never in components only.
6. `container.ts`: the single composition root (manual DI). Tests inject `FixedClock` and the test DB.

## 3. Repository layout

```
.
├── docker-compose.yml   package.json (workspaces)   .env.example
├── README.md  TRANSCRIPT.md
├── docs/  PRD.md  TECHNICAL_DESIGN.md  API.md
├── packages/shared/src/
│   ├── schemas/  booking.ts slots.ts auth.ts admin.ts common.ts
│   ├── errors.ts                       # ErrorCode enum + user-facing messages
│   └── time/  zones.ts windows.ts grid.ts rules.ts format.ts transitions.ts
├── apps/api/
│   ├── prisma/  schema.prisma  migrations/  seed.ts
│   ├── src/
│   │   ├── server.ts  app.ts  container.ts  config.ts  clock.ts
│   │   ├── http/  errors.ts  rateLimit.ts  session.ts (loadSession, requireParent,
│   │   │          requireAdmin)  originCheck.ts  cookies.ts
│   │   ├── routes/  slots.ts bookings.ts auth.ts me.ts admin.ts dev.ts health.ts
│   │   ├── controllers/  (one per route file)
│   │   ├── services/  slotService suggestionService bookingService assignmentStrategy
│   │   │              outboxService calendarService sessionService parentAuthService
│   │   │              adminAuthService adminService
│   │   ├── domain/  slotEngine.ts suggestions.ts reference.ts tokens.ts
│   │   └── repositories/  mentorRepo bookingRepo parentRepo sessionRepo authTokenRepo
│   │                      adminRepo outboxRepo
│   └── test/  unit/  integration/  helpers/ (db reset, factories, FixedClock, agent with cookies)
└── apps/web/src/
    ├── main.tsx  app/ (router.tsx, queryClient.ts, PublicLayout.tsx, AdminLayout.tsx)
    ├── components/ui/                  # shadcn primitives
    ├── lib/  api.ts  useTimezone.ts  idempotencyKey.ts
    ├── auth/  useAuth.ts (GET /auth/me)  RequireParent.tsx  RequireAdmin.tsx
    └── features/
        ├── booking/       BookPage TimezoneBar DstBanner DayStrip SlotGrid SlotButton
        │                  SelectedSlotCard BookingForm SuggestionsPanel
        ├── confirmation/  BookingPage ConfirmationCard AddToCalendar CopyLink CreateAccountPrompt
        ├── account/       SignupPage LoginPage VerifyEmailPage ForgotPasswordPage
        │                  ResetPasswordPage MyBookingsPage
        ├── admin/         AdminLoginPage DashboardPage BookingsPage ParentsPage ParentDetailPage
        │                  MentorsPage MentorDetailPage OutboxPage CapacityMeter
        └── dev/           DevOutboxPage
```

## 4. Technology

| Concern      | Choice                                                                                    | Reason                                                |
| ------------ | ----------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Language     | TypeScript 5 (strict)                                                                     | Shared types across web/api                           |
| Frontend     | React 19 + Vite 7, react-router 6                                                         | Required stack                                        |
| Server state | TanStack Query 5                                                                          | Caching, refetch on focus, mutation states            |
| Forms        | Controlled inputs validated with the shared zod schema                                    | One schema for client + server, no extra form library |
| UI           | Tailwind 4 + shadcn-style components (Radix) + lucide-react + sonner                      | Accessible, we own the code                           |
| Backend      | Express 5                                                                                 | Small, well known; async errors handled natively      |
| DB / ORM     | PostgreSQL 16 + Prisma 5                                                                  | Transactions, locks, constraints                      |
| Time         | Luxon 3                                                                                   | IANA zones, DST-aware                                 |
| Passwords    | `@node-rs/argon2` (argon2id)                                                              | Modern hash; prebuilt binaries (no node-gyp)          |
| Cookies      | `cookie-parser`                                                                           | Read session cookies                                  |
| Misc         | pino, helmet, cors, express-rate-limit, nanoid, ics                                       | Logging, security, ids, calendar files                |
| Tests        | Vitest, supertest, Testing Library, fast-check; headless-Chrome checks during development | One runner; property tests                            |

## 5. Decisions (ADRs)

| #      | Decision                                                                                                          | Why                                                                                                                                                                     | Revisit when                                   |
| ------ | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| ADR-1  | **PostgreSQL** (Docker locally; same URL works for Supabase/Neon)                                                 | `FOR UPDATE`, partial indexes, `EXCLUDE USING gist` make double-booking impossible at the storage level                                                                 | —                                              |
| ADR-2  | **Compute slots from shifts**; no slots table                                                                     | Avoids duplicated state, regeneration jobs and drift; the daily cap can't live in a slots table anyway                                                                  | Hundreds of mentors → per-day cache            |
| ADR-3  | **No soft holds**                                                                                                 | Atomic final check + suggestions handle rare races                                                                                                                      | Collision rate noticeable                      |
| ADR-4  | **Cap counts on the mentor's IST date**                                                                           | Mentor workload; stored `mentorLocalDate`; shifts don't cross midnight                                                                                                  | Shift crossing midnight                        |
| ADR-5  | **UTC instants + IANA names**                                                                                     | DST-safe; bookings snapshot both zones                                                                                                                                  | —                                              |
| ADR-6  | **Reasonable hours = parent window + mentor shift; no global IST cap**                                            | Industry practice (US night shifts) and the Calendly/Cal.com model                                                                                                      | —                                              |
| ADR-7  | **Show Full slots, hide unstaffed**                                                                               | Explains unavailability; entry to suggestions                                                                                                                           | —                                              |
| ADR-8  | **One short tx per candidate mentor**                                                                             | ≤ 1 parent + 1 mentor lock, fixed order → no deadlocks                                                                                                                  | —                                              |
| ADR-9  | **30-min UTC grid**                                                                                               | All target offsets are multiples of 30 min                                                                                                                              | —                                              |
| ADR-10 | **Guest booking; no sign-up wall**                                                                                | Free-trial conversion; Calendly invitees need no account                                                                                                                | —                                              |
| ADR-11 | **Manage link token = HMAC(APP_SECRET, bookingId)**                                                               | Nothing to store; re-derivable for idempotent replays and Outbox links; constant-time compare; scope = one booking                                                      | Need per-link revocation → stored random token |
| ADR-12 | **Own DB-backed sessions** (random id in httpOnly cookie, SHA-256 hash in DB) instead of JWT or a hosted provider | Revocable (logout, password reset); no external keys for reviewers; Lucia (the common library) was deprecated in 2025 and now recommends exactly this ~150-line pattern | SSO / many apps → hosted IdP                   |
| ADR-13 | **Email verification before showing bookings**                                                                    | Booking with an email proves nothing; verification proves inbox control, so nobody can read another family's bookings                                                   | —                                              |
| ADR-14 | **Outbox table instead of real email**                                                                            | Demo needs no SMTP; the same rows feed a real provider later                                                                                                            | Production launch                              |
| ADR-15 | **Separate cookies for parent and admin sessions**                                                                | A reviewer can be admin and parent in one browser; a parent session can never satisfy `requireAdmin`                                                                    | —                                              |

## 6. Data model

### 6.1 Prisma schema

```prisma
generator client { provider = "prisma-client-js" }
datasource db   { provider = "postgresql"  url = env("DATABASE_URL") }

enum Subject        { CODING MATH }
enum BookingStatus  { CONFIRMED CANCELLED }
enum SessionKind    { PARENT ADMIN }
enum AuthTokenPurpose { VERIFY_EMAIL RESET_PASSWORD }
enum OutboxKind {
  BOOKING_CONFIRMED_PARENT BOOKING_CONFIRMED_MENTOR
  BOOKING_CANCELLED_PARENT BOOKING_CANCELLED_MENTOR
  VERIFY_EMAIL RESET_PASSWORD ACCOUNT_EXISTS
}

model Mentor {
  id             String             @id @default(uuid()) @db.Uuid
  name           String
  email          String             @unique
  timezone       String             // IANA, e.g. Asia/Kolkata
  bio            String
  shiftLabel     String             // "UK shift" | "US-East shift" | "US-West shift"
  maxDailyTrials Int                @default(2)
  isActive       Boolean            @default(true)
  createdAt      DateTime           @default(now()) @db.Timestamptz(3)
  rules          AvailabilityRule[]
  bookings       Booking[]
}

model AvailabilityRule {               // one row = one shift block on one weekday
  id          String @id @default(uuid()) @db.Uuid
  mentorId    String @db.Uuid
  weekday     Int    // 1 = Mon … 7 = Sun, mentor's zone
  startMinute Int    // minutes since local midnight
  endMinute   Int    // exclusive, ≤ 1440
  mentor      Mentor @relation(fields: [mentorId], references: [id], onDelete: Cascade)
  @@index([mentorId])
}

model Parent {                          // created by first booking OR sign-up
  id              String      @id @default(uuid()) @db.Uuid
  name            String
  email           String      @unique   // lowercased + trimmed
  phone           String?
  timezone        String                // last used IANA zone
  passwordHash    String?               // null = guest (no account)
  emailVerifiedAt DateTime?   @db.Timestamptz(3)
  createdAt       DateTime    @default(now()) @db.Timestamptz(3)
  bookings        Booking[]
  sessions        Session[]
  authTokens      AuthToken[]
}
// account status (derived): passwordHash null → GUEST; set & not verified → PENDING; verified → VERIFIED

model AdminUser {
  id           String    @id @default(uuid()) @db.Uuid
  email        String    @unique
  name         String
  passwordHash String
  createdAt    DateTime  @default(now()) @db.Timestamptz(3)
  sessions     Session[]
}

model Session {
  id         String      @id            // SHA-256 hex of the cookie value
  kind       SessionKind
  parentId   String?     @db.Uuid
  adminId    String?     @db.Uuid
  expiresAt  DateTime    @db.Timestamptz(3)
  createdAt  DateTime    @default(now()) @db.Timestamptz(3)
  parent     Parent?     @relation(fields: [parentId], references: [id], onDelete: Cascade)
  admin      AdminUser?  @relation(fields: [adminId], references: [id], onDelete: Cascade)
  @@index([parentId])
  @@index([adminId])
}

model AuthToken {                       // email verification + password reset
  id        String           @id @default(uuid()) @db.Uuid
  tokenHash String           @unique      // SHA-256 hex
  purpose   AuthTokenPurpose
  parentId  String           @db.Uuid
  expiresAt DateTime         @db.Timestamptz(3)
  usedAt    DateTime?        @db.Timestamptz(3)
  createdAt DateTime         @default(now()) @db.Timestamptz(3)
  parent    Parent           @relation(fields: [parentId], references: [id], onDelete: Cascade)
  @@index([parentId, purpose])
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
  parentTimezone  String
  mentorTimezone  String
  meetingUrl      String
  status          BookingStatus  @default(CONFIRMED)
  cancelledAt     DateTime?      @db.Timestamptz(3)
  cancelledBy     String?        // "PARENT" | "ADMIN"
  idempotencyKey  String         @unique
  createdAt       DateTime       @default(now()) @db.Timestamptz(3)
  updatedAt       DateTime       @updatedAt @db.Timestamptz(3)
  parent          Parent         @relation(fields: [parentId], references: [id])
  mentor          Mentor         @relation(fields: [mentorId], references: [id])
  outbox          OutboxMessage[]
  @@index([startUtc])
  @@index([parentId, status])
  @@index([mentorId, startUtc])
}

model OutboxMessage {
  id        String     @id @default(uuid()) @db.Uuid
  kind      OutboxKind
  toEmail   String
  bookingId String?    @db.Uuid
  timezone  String?    // zone the body was rendered in
  subject   String
  body      String     // plain text; links are absolute URLs
  createdAt DateTime   @default(now()) @db.Timestamptz(3)
  booking   Booking?   @relation(fields: [bookingId], references: [id], onDelete: Cascade)
  @@index([createdAt])
}
```

### 6.2 Constraints (hand-written SQL migration)

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Booking"
  ADD CONSTRAINT booking_time_valid  CHECK ("endUtc" > "startUtc"),
  ADD CONSTRAINT booking_grade_valid CHECK ("childGrade" BETWEEN 1 AND 12),
  ADD CONSTRAINT booking_no_overlap_per_mentor
    EXCLUDE USING gist ("mentorId" WITH =, tstzrange("startUtc", "endUtc", '[)') WITH &&)
    WHERE (status = 'CONFIRMED');

CREATE INDEX booking_mentor_day_confirmed
  ON "Booking" ("mentorId", "mentorLocalDate") WHERE status = 'CONFIRMED';

ALTER TABLE "AvailabilityRule"
  ADD CONSTRAINT rule_weekday CHECK (weekday BETWEEN 1 AND 7),
  ADD CONSTRAINT rule_bounds  CHECK ("startMinute" >= 0 AND "startMinute" < "endMinute" AND "endMinute" <= 1440);

ALTER TABLE "Session"
  ADD CONSTRAINT session_subject CHECK (
    (kind = 'PARENT' AND "parentId" IS NOT NULL AND "adminId" IS NULL) OR
    (kind = 'ADMIN'  AND "adminId"  IS NOT NULL AND "parentId" IS NULL));
```

The **daily cap** depends on a count, so it isn't a DB constraint. It's enforced inside the locked transaction (§9.1).

## 7. Time module (`packages/shared/src/time`)

Pure functions with explicit zones; nothing reads the system zone.

| Function              | Signature                                             | Behaviour                                                                                                             |
| --------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `normalizeZone`       | `(zone) => string`                                    | IANA names + aliases (`Asia/Calcutta` → `Asia/Kolkata`, `US/Eastern` → `America/New_York`); throws `InvalidZoneError` |
| `localDayWindow`      | `(date, zone) => Interval`                            | `[startOf('day'), +1 day)`; 23/25 h on DST days                                                                       |
| `dayWindow`           | `(date, zone, startMin, endMin) => Interval`          | e.g. 08:00–21:00 on that local date, built per date                                                                   |
| `localClockMinutes`   | `(instant, zone) => number`                           | Minutes since local midnight                                                                                          |
| `localDate`           | `(instant, zone) => ISODate`                          | e.g. `mentorLocalDate`                                                                                                |
| `gridStarts`          | `(interval, stepMin) => Instant[]`                    | UTC instants aligned to `stepMin` since epoch                                                                         |
| `expandRules`         | `(rules, zone, interval) => Interval[]`               | Each local date touching the interval (±1 day): matching weekday rules → UTC intervals; gap times shift forward       |
| `zoneAbbreviation`    | `(zone, instant) => string`                           | Overrides first (`Europe/London` BST/GMT, `Europe/Dublin` GMT+1/GMT, `Asia/Kolkata` "IST (India)"), else `Intl` short |
| `formatZoneLabel`     | `(zone, instant) => string`                           | "Eastern Time (UTC−04:00)", "UK time (UTC+01:00)", "Irish time (UTC+01:00)", "India Standard Time (UTC+05:30)"        |
| `formatSlot`          | `(instant, zone) => string`                           | `Sat 31 Oct · 8:30 AM EDT`                                                                                            |
| `timeOfDayGroup`      | `(instant, zone)`                                     | `morning` < 12:00 ≤ `afternoon` < 17:00 ≤ `evening`                                                                   |
| `upcomingTransitions` | `(zone, interval) => {atUtc, fromOffset, toOffset}[]` | Offset changes in the interval                                                                                        |

`PINNED_ZONES`: America/New_York, America/Chicago, America/Denver, America/Phoenix, America/Los_Angeles, America/Anchorage, Pacific/Honolulu, Europe/London, Europe/Dublin, Asia/Kolkata.

## 8. Slot engine

### 8.1 Rules every offered slot satisfies

For class `c = [s, s + 60 min)`:

| Rule             | Check                                                                                   |
| ---------------- | --------------------------------------------------------------------------------------- |
| Grid             | `s` aligned to 30 min                                                                   |
| Notice / horizon | `now + MIN_NOTICE ≤ s` and `s < startOf(today_parent) + HORIZON days`                   |
| Parent window    | `c ⊆ dayWindow(localDate(s, parentTz), parentTz, PARENT_HOURS_START, PARENT_HOURS_END)` |
| Staffed by m     | `c ⊆` one of m's expanded shift intervals                                               |
| Free for m       | no CONFIRMED booking of m overlapping `c`                                               |
| Under cap for m  | `count(CONFIRMED of m on localDate(s, m.tz)) < m.maxDailyTrials`                        |

`staffed(c)` = mentors passing _Staffed_; `available(c)` = staffed ∧ free ∧ under cap.

### 8.2 `buildSlots` (pure, `domain/slotEngine.ts`)

```
input:  parentTz, fromDate, days, now, config, mentors(+rules), bookings(CONFIRMED, range ±1 day)
output: { days: DaySlots[], transitions }

for each mentor m:
    shifts[m] = expandRules(m.rules, m.timezone, range ± 1 day)
    busy[m]   = m's bookings as intervals
    count[m]  = map mentorLocalDate → bookings
for each local date d in [fromDate, fromDate + days):
    win = dayWindow(d, parentTz, PARENT_START, PARENT_END)
    for s in gridStarts(win, STEP) where s + DURATION ≤ win.end and notice/horizon ok:
        staffed = mentors with c ⊆ some shift;  if none: continue        -- hidden (ADR-7)
        available = staffed.filter(free && underCap)
        push { startUtc: s, endUtc: s + 60, status: available ? OPEN : FULL,
               availableMentors: available.length }
    day.status = any OPEN ? OPEN : slots ? FULL : CLOSED
```

`SlotService.getSlots(tz, from, days)` = 2 queries + `buildSlots`. The same function powers suggestions and the booking pre-check, so all three always agree.

### 8.3 Suggestion cascade (pure, `domain/suggestions.ts`)

```
rankSuggestions(days, D, T, tz, limits):
  open(d) = Open slots on d;  dist(x) = |localClockMinutes(x) − T|
  1 SAME_DAY   open(D) ≠ ∅ → sort by dist, then start; take 4
  2 SAME_TIME  else days d ≠ D having an Open slot with localClockMinutes == T;
               sort by |d − D|, ties later day first; take 3;
               note DST_SHIFT if "T staffed" flips across a transition
  3 NEAREST    else days ascending from today; ≤ 2 per day by dist; stop at 4
  4 NONE
  → { strategy, requested: { date, time, timezone }, suggestions, notes }
```

`SuggestionService.suggest(tz, D, T)` = `getSlots(tz, today, HORIZON)` → `rankSuggestions`.

## 9. Booking

### 9.1 Create (`BookingService.create`)

```
POST /api/bookings   Idempotency-Key: <uuid v4>    (optional parent session)

1. existing = findByIdempotencyKey(key) → 201 with it (same body, manageUrl re-derived)
2. Validate body (shared zod); tz = normalizeZone(body.timezone)
   if parent session: body.parent.email must equal session email → else 422 VALIDATION
3. Pre-check via buildSlots for that instant:
     off grid / beyond horizon                 → 422 VALIDATION
     < now + notice                            → 422 SLOT_TOO_SOON   (+ suggestions)
     outside parent window or no staffed mentor → 422 OUTSIDE_HOURS  (+ suggestions)
4. candidates = AssignmentStrategy.rank(available mentors)        (empty → 6)
5. for m in candidates:                                 -- one SHORT tx each (ADR-8)
     tx:
       parent = upsert by email (guest fields name/phone/timezone updated only if no account)
       SELECT … FROM "Parent" WHERE id = $p FOR UPDATE
       CONFIRMED booking for parent with startUtc > now → ACTIVE_TRIAL_EXISTS (409)
       SELECT … FROM "Mentor" WHERE id = $m FOR UPDATE
       overlap or dayCount(mentorLocalDate) ≥ max → rollback, continue
       insert Booking
          23P01 → rollback, continue
          23505 reference → regenerate (≤ 3) ; 23505 idempotencyKey → return existing
       insert 2 OutboxMessages (parent zone / mentor zone)
     → 201 BookingDto (includes manageUrl)
6. → 409 SLOT_UNAVAILABLE (+ suggestions for D = localDate(start, tz), T = localClockMinutes(start, tz))
```

**Why it is safe:** writers per mentor serialize on the mentor row lock; the exclusion constraint is a backstop; ≤ 1 parent + 1 mentor lock in fixed order (no deadlocks); same-email tabs serialize on the parent lock; unique idempotency key.

### 9.2 AssignmentStrategy

`BalancedAssignment` sorts available mentors by: (1) fewest CONFIRMED on that IST date; (2) fewest other Open slots that IST date where this mentor is available (keep flexible mentors free); (3) id ascending.

### 9.3 Validation (shared zod schemas)

| Field                      | Rule                             | Message                                                      |
| -------------------------- | -------------------------------- | ------------------------------------------------------------ |
| `parent.name`              | trim, 2–80                       | "Please enter your name"                                     |
| `parent.email`             | trim, lowercase, email, ≤ 254    | "Please enter a valid email"                                 |
| `parent.phone`             | optional `^\+?[0-9 ()-]{7,20}$`  | "Please enter a valid phone number"                          |
| `child.name`               | trim, 1–60                       | "Please enter your child's name"                             |
| `child.grade`              | int 1–12                         | "Choose a grade between 1 and 12"                            |
| `subject`                  | `CODING` \| `MATH`               | "Choose a subject"                                           |
| `startUtc`                 | ISO `Z`, seconds 0, minutes 0/30 | "Please pick a time from the list"                           |
| `timezone`                 | `normalizeZone` ok               | "Please choose your time zone"                               |
| `Idempotency-Key`          | UUID v4                          | 400 `VALIDATION`                                             |
| `password` (sign-up/reset) | 8–128 chars, ≠ email             | "Use at least 8 characters" / "Password can't be your email" |

### 9.4 Generated values

- `reference`: `CY-` + 6 chars of `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`.
- `meetingUrl`: `${MEETING_BASE_URL}/${reference}-${nanoid(10)}`.
- `manageToken` = base64url(HMAC-SHA256(`APP_SECRET`, `"manage:" + booking.id`)); `manageUrl` = `${APP_BASE_URL}/booking/${reference}?token=${manageToken}`.
- Outbox bodies (rendered with `formatSlot` in the recipient's zone):
  - Parent confirmed: "Your free {Subject} trial for {child} is confirmed for {Sat 31 Oct · 3:00 PM EDT} with {mentor}. Join: {meetingUrl}. Manage: {manageUrl}. Create an account to see all your bookings: {APP_BASE_URL}/signup"
  - Mentor confirmed: "New trial: {child} (Grade {g}, {Subject}) on {Sun 1 Nov · 12:30 AM IST (India)}. Parent's time: {Sat 31 Oct · 3:00 PM EDT}. Join: {meetingUrl}"
  - Cancelled (parent/mentor): same pattern with "cancelled", plus "cancelled by Codeyoung" when admin did it.

### 9.5 Read and cancel

`BookingAccess.authorize(ref, { token?, parentSession?, adminSession? })` → booking or `NOT_FOUND`:

- valid `token` (constant-time compare) **or**
- parent session whose parent owns the booking **and** is VERIFIED **or**
- admin session.

Cancel: authorized as above; `startUtc ≤ now` → 422 `ALREADY_STARTED`; already CANCELLED → 200 unchanged; else `status=CANCELLED, cancelledAt, cancelledBy` + 2 Outbox messages. Capacity frees automatically (counts and the constraint only look at CONFIRMED).

## 10. Auth & access

### 10.1 Sessions (`sessionService`, `http/session.ts`)

| Item     | Parent                                                   | Admin          |
| -------- | -------------------------------------------------------- | -------------- |
| Cookie   | `cy_parent_sid`                                          | `cy_admin_sid` |
| Value    | 32 random bytes, base64url                               | same           |
| Stored   | `Session.id = sha256(value)`, kind, subject, `expiresAt` | same           |
| Lifetime | 7 days; extended to 7 days when < 3.5 days left          | 12 h fixed     |
| Flags    | `HttpOnly; SameSite=Lax; Path=/; Secure` in production   | same           |

- `loadSession` middleware: read both cookies → hash → find unexpired session → `req.auth = { parent?, admin? }`. Expired rows are deleted when found and on server start.
- `requireParent`: 401 `UNAUTHENTICATED` without a session; 403 `EMAIL_NOT_VERIFIED` if not verified (sessions are only created for verified parents, so this is defensive).
- `requireAdmin`: 401 without an admin session.
- Sign-in **rotates**: delete any existing session from that cookie, create a new one.

### 10.2 CSRF and cross-origin

- SameSite=Lax cookies + `originCheck` on POST/PUT/PATCH/DELETE: if the request carries a session cookie, its `Origin` (or `Referer`) must equal `APP_BASE_URL`, else 403 `ORIGIN_MISMATCH`.
- JSON bodies only (`express.json`); `CORS_ORIGIN = APP_BASE_URL` with `credentials: true`. In dev the Vite proxy makes API calls same-origin.

### 10.3 Tokens (`domain/tokens.ts`)

- `newToken()` → 32 random bytes base64url; `hashToken(t)` → SHA-256 hex. Only hashes are stored.
- VERIFY_EMAIL: valid 24 h. RESET_PASSWORD: valid 1 h. Single use (`usedAt`). Issuing a new token of a purpose invalidates older unused ones.

### 10.4 Flows (`parentAuthService`, `adminAuthService`)

| Flow                                  | Steps                                                                                                                                                                                                                                    | Response                          |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| **Sign-up** `{name, email, password}` | find Parent by email. VERIFIED → Outbox `ACCOUNT_EXISTS` (sign-in + reset links), change nothing. Otherwise upsert Parent (create if new; set name, `passwordHash`; `emailVerifiedAt = null`), issue VERIFY token, Outbox `VERIFY_EMAIL` | Always **202** "Check your email" |
| **Resend verification** `{email}`     | if PENDING → new token + Outbox                                                                                                                                                                                                          | Always 202                        |
| **Verify** `{token}`                  | find by hash, purpose, unused, unexpired → set `emailVerifiedAt`, mark used                                                                                                                                                              | 200 / 400 `TOKEN_INVALID`         |
| **Sign-in** `{email, password}`       | find Parent; if none or no hash → verify against a dummy hash (equal timing) → 401 `INVALID_CREDENTIALS`. Wrong password → 401. Correct but PENDING → 403 `EMAIL_NOT_VERIFIED`. Else create session, set cookie                          | 200 `{ parent }`                  |
| **Forgot** `{email}`                  | if account exists (PENDING or VERIFIED) → RESET token + Outbox                                                                                                                                                                           | Always 202                        |
| **Reset** `{token, password}`         | valid RESET token → new hash, mark used, set `emailVerifiedAt` if null (inbox proven), **delete all parent sessions**                                                                                                                    | 200 / 400 `TOKEN_INVALID`         |
| **Sign-out**                          | delete session, clear cookie                                                                                                                                                                                                             | 204                               |
| **Admin sign-in** `{email, password}` | AdminUser lookup + argon2 verify (dummy hash if missing) → admin session                                                                                                                                                                 | 200 / 401                         |

Rate limits (express-rate-limit, keyed by IP + lowercased email where present): sign-in, sign-up, resend, forgot = 5/min; admin sign-in = 5/min; `POST /bookings` = 10/min per IP.

Argon2id parameters: library defaults (memory 19 MiB, 2 iterations), per OWASP minimums.

### 10.5 Authorization matrix (enforced in middleware + services)

| Endpoint group              | Anonymous                      | Manage token     | Parent (verified)   | Admin |
| --------------------------- | ------------------------------ | ---------------- | ------------------- | ----- |
| `/slots*`, `POST /bookings` | ✓                              | ✓                | ✓ (email = account) | —     |
| `GET/POST /bookings/:ref*`  | —                              | ✓ (that booking) | ✓ own               | ✓     |
| `/me/*`                     | —                              | —                | ✓                   | —     |
| `/admin/*`                  | —                              | —                | —                   | ✓     |
| `/dev/outbox`               | ✓ only if `DEV_OUTBOX_ENABLED` |                  |                     |       |

Ownership failures return **404**, not 403, so they don't confirm a booking exists.

## 11. API

Base `/api`. JSON. Instants are ISO-8601 UTC. Error envelope:

```json
{ "error": { "code": "SLOT_UNAVAILABLE", "message": "That time was just booked.", "details": {} } }
```

### 11.1 Endpoints

**Public: slots and booking**

| Method | Path                                 | Success                             | Errors        |
| ------ | ------------------------------------ | ----------------------------------- | ------------- |
| GET    | `/health`                            | 200 `{ status, db }`                | 503           |
| GET    | `/slots?tz&from&days`                | 200 `SlotsResponse`                 | 422           |
| GET    | `/slots/suggestions?tz&date&time`    | 200 `SuggestionsResponse`           | 422           |
| POST   | `/bookings` (+ `Idempotency-Key`)    | 201 `BookingDto` (with `manageUrl`) | 409, 422, 429 |
| GET    | `/bookings/:ref?token=`              | 200 `BookingDto`                    | 404           |
| POST   | `/bookings/:ref/cancel` `{ token? }` | 200 `BookingDto`                    | 404, 422      |
| GET    | `/bookings/:ref/calendar.ics?token=` | 200 `text/calendar`                 | 404           |

**Auth**

| Method | Path                               | Body                  | Success                                                      | Errors        |
| ------ | ---------------------------------- | --------------------- | ------------------------------------------------------------ | ------------- |
| GET    | `/auth/me`                         | —                     | 200 `{ parent: ParentDto \| null, admin: AdminDto \| null }` | —             |
| POST   | `/auth/parent/signup`              | name, email, password | 202                                                          | 422, 429      |
| POST   | `/auth/parent/resend-verification` | email                 | 202                                                          | 429           |
| POST   | `/auth/parent/verify`              | token                 | 200                                                          | 400           |
| POST   | `/auth/parent/login`               | email, password       | 200 + cookie                                                 | 401, 403, 429 |
| POST   | `/auth/parent/forgot-password`     | email                 | 202                                                          | 429           |
| POST   | `/auth/parent/reset-password`      | token, password       | 200                                                          | 400, 422      |
| POST   | `/auth/parent/logout`              | —                     | 204                                                          | —             |
| POST   | `/auth/admin/login`                | email, password       | 200 + cookie                                                 | 401, 429      |
| POST   | `/auth/admin/logout`               | —                     | 204                                                          | —             |

**Parent (verified session)**

| Method | Path                                | Success                                                    |
| ------ | ----------------------------------- | ---------------------------------------------------------- |
| GET    | `/me/bookings?scope=upcoming\|past` | 200 `BookingDto[]` (past includes cancelled; newest first) |

**Admin (admin session)**

| Method | Path                                                      | Success                                                                                                                                                                             |
| ------ | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/admin/dashboard?days=14`                                | 200 `{ todayCount, next7DaysCount, capacity: [{ istDate, booked, capacity }], fullyBookedIstDates }`. `capacity` = sum of `maxDailyTrials` of mentors with a shift that IST weekday |
| GET    | `/admin/bookings?from&to&status&mentorId&q&page&pageSize` | 200 `{ items: AdminBookingDto[], total }` (`q` matches parent email/name, child name, reference)                                                                                    |
| POST   | `/admin/bookings/:id/cancel`                              | 200 `AdminBookingDto`                                                                                                                                                               |
| GET    | `/admin/parents?q&page&pageSize`                          | 200 `{ items: [{ id, name, email, status, bookingCount, upcomingCount }], total }`                                                                                                  |
| GET    | `/admin/parents/:id`                                      | 200 `{ parent, bookings: AdminBookingDto[] }`                                                                                                                                       |
| GET    | `/admin/mentors`                                          | 200 `[{ id, name, shiftLabel, timezone, todayBooked, maxDailyTrials, weeklyShift }]`                                                                                                |
| GET    | `/admin/mentors/:id/schedule?from&days`                   | 200 `{ mentor, weeklyShift, days: [{ istDate, onShift, booked, max, bookings: AdminBookingDto[] }] }`                                                                               |
| GET    | `/admin/outbox?page&pageSize`                             | 200 `{ items: OutboxDto[], total }`                                                                                                                                                 |

**Dev**

| Method | Path                   | Success                                                         |
| ------ | ---------------------- | --------------------------------------------------------------- |
| GET    | `/dev/outbox?limit=50` | 200 `OutboxDto[]` (only if `DEV_OUTBOX_ENABLED=true`, else 404) |

Defaults: `from` = today in `tz` (IST for admin), `days` = 14 (max 31 for admin, 14 for public), `pageSize` = 25 (max 100).

### 11.2 Error codes

| Code                  | HTTP    | When                              | `details`                           | UI                                          |
| --------------------- | ------- | --------------------------------- | ----------------------------------- | ------------------------------------------- |
| `VALIDATION`          | 400/422 | Bad header/body/query             | `{ fieldErrors }`                   | Inline errors                               |
| `SLOT_TOO_SOON`       | 422     | Start < now + notice              | `{ suggestions }`                   | Suggestions panel                           |
| `OUTSIDE_HOURS`       | 422     | Outside parent window / no shift  | `{ suggestions }`                   | Suggestions panel                           |
| `SLOT_UNAVAILABLE`    | 409     | No candidate succeeded            | `{ suggestions }`                   | "That time was just booked." + suggestions  |
| `ACTIVE_TRIAL_EXISTS` | 409     | Email has an upcoming trial       | `{ reference, startUtc, timezone }` | Existing-booking card                       |
| `NOT_FOUND`           | 404     | Unknown, or not authorized to see | —                                   | "We couldn't find this booking."            |
| `ALREADY_STARTED`     | 422     | Cancel after start                | —                                   | "This class has already started…"           |
| `UNAUTHENTICATED`     | 401     | No/expired session                | —                                   | Redirect to login with `?next=`             |
| `FORBIDDEN`           | 403     | Wrong role                        | —                                   | Redirect to correct login                   |
| `INVALID_CREDENTIALS` | 401     | Bad email/password                | —                                   | "Email or password is incorrect."           |
| `EMAIL_NOT_VERIFIED`  | 403     | Pending account sign-in           | —                                   | "Please verify your email first." + resend  |
| `TOKEN_INVALID`       | 400     | Bad/expired/used token            | —                                   | "This link has expired. Request a new one." |
| `ORIGIN_MISMATCH`     | 403     | Cross-site state change           | —                                   | Generic error                               |
| `RATE_LIMITED`        | 429     | Too many attempts                 | —                                   | "Too many attempts. Try again in a minute." |
| `INTERNAL`            | 500     | Unexpected                        | —                                   | "Something went wrong. Please try again."   |

### 11.3 Examples

`POST /api/bookings` (guest)

```json
{
  "parent": { "name": "Jane Doe", "email": "jane@example.com", "phone": "+1 555 010 2000" },
  "child": { "name": "Sam", "grade": 4 },
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
  "manageUrl": "http://localhost:5173/booking/CY-7K3P9Q?token=…",
  "child": { "name": "Sam", "grade": 4 },
  "subject": "CODING",
  "mentor": { "name": "Vikram Nair", "bio": "…", "shiftLabel": "US-East shift" },
  "googleCalendarUrl": "https://calendar.google.com/calendar/render?action=TEMPLATE&…"
}
```

`409 Conflict`

```json
{
  "error": {
    "code": "SLOT_UNAVAILABLE",
    "message": "That time was just booked.",
    "details": {
      "suggestions": {
        "strategy": "SAME_DAY",
        "requested": { "date": "2026-10-20", "time": "15:00", "timezone": "America/New_York" },
        "suggestions": [{ "startUtc": "2026-10-20T19:30:00.000Z", "endUtc": "…", "status": "OPEN", "availableMentors": 1 }],
        "notes": []
      }
    }
  }
}
```

`GET /api/admin/mentors/:id/schedule?from=2026-10-21&days=1`

```json
{
  "mentor": { "id": "…", "name": "Vikram Nair", "shiftLabel": "US-East shift", "timezone": "Asia/Kolkata" },
  "weeklyShift": [{ "weekday": 3, "start": "00:30", "end": "07:30" }],
  "days": [
    {
      "istDate": "2026-10-21",
      "onShift": true,
      "booked": 1,
      "max": 2,
      "bookings": [
        {
          "reference": "CY-7K3P9Q",
          "startUtc": "2026-10-20T19:00:00.000Z",
          "child": { "name": "Sam", "grade": 4 },
          "subject": "CODING",
          "parent": { "name": "Jane Doe", "email": "jane@example.com" },
          "parentTimezone": "America/New_York",
          "status": "CONFIRMED",
          "meetingUrl": "…"
        }
      ]
    }
  ]
}
```

Full examples for every endpoint go in `docs/API.md`.

### 11.4 Cross-cutting

helmet; `cors({ origin: APP_BASE_URL, credentials: true })`; `express.json({ limit: '10kb' })`; `cookie-parser`; pino-http with request id (no emails/passwords/tokens logged). The error middleware maps `AppError` → envelope and everything else → `INTERNAL`.

## 12. Frontend

### 12.1 Routes

| Path                                                                                         | Guard                                  | Page                                   |
| -------------------------------------------------------------------------------------------- | -------------------------------------- | -------------------------------------- |
| `/`                                                                                          | —                                      | redirect `/book`                       |
| `/book`                                                                                      | —                                      | `BookPage`                             |
| `/booking/:ref`                                                                              | token in query, or owner/admin session | `BookingPage`                          |
| `/signup`, `/login`, `/verify-email`, `/forgot-password`, `/reset-password`                  | —                                      | account pages                          |
| `/my-bookings`                                                                               | `RequireParent`                        | `MyBookingsPage`                       |
| `/admin/login`                                                                               | —                                      | `AdminLoginPage`                       |
| `/admin`, `/admin/bookings`, `/admin/parents[/:id]`, `/admin/mentors[/:id]`, `/admin/outbox` | `RequireAdmin`                         | admin pages in `AdminLayout` (sidebar) |
| `/dev/outbox`                                                                                | — (404 if disabled)                    | `DevOutboxPage`                        |

`useAuth()` = TanStack Query on `GET /auth/me`; invalidated after login/logout. On any API 401, redirect to the matching login with `?next=<current path>`. Header: guests see "Sign in"; parents see "My bookings · Sign out".

### 12.2 Booking page state machine

```
selectTime ──open slot──▶ details ──submit──▶ submitting
   │   ▲                    ▲  │                 ├─ 201 → navigate to manageUrl path
   │   └──── change time ───┘  │                 ├─ 409/422 slot errors → SuggestionsPanel (form kept)
   │ full slot / day           └─ pick suggestion┤
   └──▶ SuggestionsPanel                         └─ 409 ACTIVE_TRIAL_EXISTS → existing-booking card
```

- An idempotency key is created when entering `details`, regenerated when the slot changes, and reused on retries.
- Slots query: `staleTime` 30 s, refetch on focus, invalidated after booking errors.
- Signed-in parent: name and email pre-filled; email read-only.
- `useTimezone()`: localStorage → `Intl` → normalised; null → picker opens.

### 12.3 Components

| Component                                                                                                               | Responsibility                                                                                                                |
| ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `TimezoneBar`, `DstBanner`, `DayStrip`, `SlotGrid`, `SlotButton`, `SelectedSlotCard`, `BookingForm`, `SuggestionsPanel` | Booking flow (badges: Open ≥ 3, Few left 1–2, Full, No classes; Full slots muted + "Full" tag; strategy headlines per PRD §8) |
| `ConfirmationCard`, `CopyLink`, `AddToCalendar`, `CreateAccountPrompt`                                                  | Confirmation; the prompt appears for guests                                                                                   |
| `SignupPage` … `ResetPasswordPage`                                                                                      | Forms with shared schemas; success copy per PRD §11; in dev, a "Open dev outbox" link under "Check your email"                |
| `MyBookingsPage`                                                                                                        | Tabs Upcoming / Past & cancelled; cards with cancel                                                                           |
| `AdminLayout`                                                                                                           | Sidebar: Dashboard, Bookings, Parents, Mentors, Outbox; admin name + sign out                                                 |
| `DashboardPage`                                                                                                         | Tiles (today, next 7 days) + capacity bar per IST date (booked / capacity)                                                    |
| `BookingsPage`                                                                                                          | Filters (date range, status, mentor, search) + table + cancel dialog; times "IST · parent-local"                              |
| `ParentsPage`, `ParentDetailPage`                                                                                       | Table with status badges; detail with bookings                                                                                |
| `MentorsPage`, `MentorDetailPage`                                                                                       | Table with shift + today's load; detail with weekly shift + schedule by IST date (`CapacityMeter`)                            |
| `OutboxPage`, `DevOutboxPage`                                                                                           | Message list, links clickable                                                                                                 |

Tables use shadcn `Table` with simple server-side pagination; no table library.

## 13. Design system

The clickable prototype (`docs/ui-prototype.html`) is the visual reference. It follows shadcn/ui defaults so the real app can use the stock components with few changes.

- **Base:** Tailwind CSS + shadcn/ui (Radix). Components live in our repo and are themed through CSS-variable tokens; light and dark themes.
- **Type:** Geist (shadcn's default) with Geist Mono for references and links; 14 px base, `tabular-nums` for every time and count.
- **Colour:** zinc neutrals with **one brand accent (violet)**, used only for selection and the main parent CTA.

| Token                                       | Light                                                        | Dark                  | Use                                         |
| ------------------------------------------- | ------------------------------------------------------------ | --------------------- | ------------------------------------------- |
| `--background` / `--foreground`             | `#FFFFFF` / `#09090B`                                        | `#09090B` / `#FAFAFA` | Surfaces, text                              |
| `--muted` / `--muted-foreground`            | `#F4F4F5` / `#71717A`                                        | `#1F1F23` / `#A1A1AA` | Secondary text, available days, Full slots  |
| `--border`                                  | `#E4E4E7`                                                    | `#27272A`             | Borders, separators                         |
| `--primary`                                 | `#18181B`                                                    | `#FAFAFA`             | Default buttons (sign in, save)             |
| `--brand`                                   | `#7C3AED`                                                    | `#8B5CF6`             | Selected day, "Confirm booking", focus ring |
| `--success` / `--warning` / `--destructive` | green / amber / red (soft backgrounds for badges and alerts) | same hues, lighter    | Available · Few left · Full / errors        |
| radius                                      | 8 px controls, 14–16 px cards                                |                       |                                             |

- **Components used:** Button (primary, brand, outline, ghost, destructive), Input, Select, Label, Card, Badge, Alert, Tabs, Calendar, Command (time-zone search), Popover, DropdownMenu, AlertDialog (cancel), Sheet (admin booking details), Sidebar + Breadcrumb (admin), Table, Progress, Sonner toasts, Avatar.
- **Parent booking layout:** one card with three panes, the pattern parents know from Cal.com/Calendly. Pane 1 holds class details and the time-zone picker. Pane 2 is a month calendar with availability dots: green Available, amber Few left, red Fully booked. Pane 3 lists the day's times with a 12h/24h toggle; Full times are dashed. Suggestions replace the time list in place. Step 2 swaps the calendar and times for the details form, and the chosen time stays pinned in pane 1. Panes stack below 960 px.
- **Calendar week start:** Sunday for US zones, Monday for European zones.
- **Admin layout:** shadcn dashboard pattern: sidebar with grouped nav, inset content with breadcrumb, stat cards, bar chart (booked vs capacity per IST date), data tables with search and filter toolbar, row action menus, booking-detail sheet.
- **Not chosen:** MUI / Ant Design (heavier, harder to give a friendly consumer look).

## 14. Configuration and local setup

| Variable                                           | Default                                                        | Meaning                                                   |
| -------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------- |
| `NODE_ENV`                                         | `development`                                                  | `production` enables Secure cookies                       |
| `DATABASE_URL`                                     | `postgresql://postgres:postgres@localhost:5432/codeyoung`      | Dev DB                                                    |
| `TEST_DATABASE_URL`                                | `postgresql://postgres:postgres@localhost:5433/codeyoung_test` | Tests                                                     |
| `PORT`                                             | `4000`                                                         | API port                                                  |
| `APP_BASE_URL`                                     | `http://localhost:5173`                                        | Web origin; used in links, CORS, Origin check             |
| `APP_SECRET`                                       | — (required, ≥ 32 chars)                                       | HMAC key for manage links                                 |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME`    | `admin@codeyoung-demo.com` / — (required) / `Codeyoung Admin`  | Seeded admin                                              |
| `DEV_OUTBOX_ENABLED`                               | `true` in dev                                                  | Exposes `/dev/outbox`                                     |
| `PARENT_SESSION_DAYS` / `ADMIN_SESSION_HOURS`      | `7` / `12`                                                     | Session lifetimes                                         |
| `MIN_NOTICE_MINUTES`                               | `120`                                                          | Earliest bookable offset                                  |
| `BOOKING_HORIZON_DAYS`                             | `14`                                                           | Bookable window (set 30 to see the 1 Nov DST change live) |
| `SLOT_STEP_MINUTES` / `CLASS_DURATION_MINUTES`     | `30` / `60`                                                    | Grid and trial length                                     |
| `DEFAULT_MAX_DAILY_TRIALS`                         | `2`                                                            | Cap per IST date                                          |
| `PARENT_HOURS_START` / `PARENT_HOURS_END`          | `08:00` / `21:00`                                              | Parent window                                             |
| `SUGGESTIONS_SAME_DAY` / `_SAME_TIME` / `_NEAREST` | `4` / `3` / `4`                                                | Suggestion limits                                         |
| `MEETING_BASE_URL`                                 | `https://meet.codeyoung-demo.com/trial`                        | Dummy link base                                           |

Env is parsed with zod on boot; missing/invalid values exit with a clear message. `.env.example` has dev values for everything (including a dev `APP_SECRET` and `ADMIN_PASSWORD`).

**Root scripts:** `dev`, `build`, `test`, `test:unit`, `test:integration`, `db:up`, `db:migrate`, `db:seed`, `db:reset`, `lint`, `typecheck`.

## 15. Seed data (`apps/api/prisma/seed.ts`)

**Admin:** from `ADMIN_EMAIL` / `ADMIN_PASSWORD` (upserted; password re-hashed on each seed).

**Mentors** (`Asia/Kolkata`, cap 2; day off in IST):

| #   | Name           | Shift         | IST hours   | Day off |
| --- | -------------- | ------------- | ----------- | ------- |
| 1   | Aarav Sharma   | UK shift      | 13:00–23:30 | Mon     |
| 2   | Priya Iyer     | UK shift      | 13:00–23:30 | Wed     |
| 3   | Rohan Mehta    | UK shift      | 13:00–23:30 | Fri     |
| 4   | Ananya Reddy   | UK shift      | 13:00–23:30 | Sun     |
| 5   | Vikram Nair    | US-East shift | 00:30–07:30 | Tue     |
| 6   | Sneha Kulkarni | US-East shift | 00:30–07:30 | Thu     |
| 7   | Arjun Desai    | US-East shift | 00:30–07:30 | Sat     |
| 8   | Kavya Menon    | US-East shift | 00:30–07:30 | Sun     |
| 9   | Ishaan Gupta   | US-West shift | 03:30–09:30 | Mon     |
| 10  | Meera Pillai   | US-West shift | 03:30–09:30 | Fri     |

An IST Saturday 00:30–07:30 US-East shift is US **Friday** evening.

**Parents and bookings.** All bookings go through `BookingService` with a `FixedClock`, so every invariant holds. Dates are relative to today; New York zone unless stated.

| Scenario           | How                                                                                                                                                      | Shows                                                       |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| S1 Mentor at cap   | 2 bookings for Aarav on tomorrow's IST date                                                                                                              | `2/2` in admin; Aarav absent from other slots               |
| S2 Full slot       | Day + 2, 9:30 AM EDT (19:00 IST): book until no mentor is free                                                                                           | Full slot → suggestions step 1                              |
| S3 Full day        | Day + 4: book every Open slot of that New York date                                                                                                      | Full day → suggestions step 2                               |
| S4 Cancelled       | Booking on day + 5, then cancelled                                                                                                                       | Cancelled state; slot open again                            |
| S5 Verified parent | `demo.parent@example.com` / `Parent123!`, verified; one upcoming booking (London zone) + one **past** booking (created with `FixedClock` = now − 3 days) | My bookings: both tabs populated                            |
| S6 Pending parent  | `pending.parent@example.com`, signed up, not verified; one guest booking                                                                                 | Sign-in shows "verify your email"; Outbox has the link      |
| S7 Guest only      | `guest.parent@example.com`, one booking, no account                                                                                                      | Admin status "Guest"; sign-up then verify → booking appears |

Other scenario bookings use `seed+N@example.com` (one active trial per email). The script prints the admin login, demo parent login, and each scenario's reference + manage URL.

## 16. Testing

| Level                        | Location                                                                      | Must cover                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Unit: time**               | `packages/shared`                                                             | DST day lengths (NY 2026-11-01 = 25 h, 2027-03-14 = 23 h); T1 conversions; Phoenix/Kolkata unchanged; aliases; labels (never bare "IST", London BST); repeated-hour labels; `expandRules` across dates and a spring-forward gap                                                                                                                                                                                                                                                                                                                                                    |
| **Unit: slot engine**        | `apps/api/test/unit`                                                          | PRD §7.3 table as fixtures (20 Oct and 10 Nov 2026); property test (fast-check; pinned zones × 60 days × random bookings): no slot outside the parent window, every OPEN slot staffed and under cap, no FULL slot unstaffed                                                                                                                                                                                                                                                                                                                                                        |
| **Unit: suggestions**        | same                                                                          | All 4 strategies, ordering and ties, DST note, limits                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Unit: assignment, tokens** | same                                                                          | Ranking; `hashToken`; manage-token HMAC verify (constant-time; wrong booking id fails)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Integration: booking**     | `apps/api/test/integration` (Postgres :5433, `FixedClock`, truncate per test) | Happy path + 2 Outbox messages in the right zones; cap; `OUTSIDE_HOURS`; `SLOT_TOO_SOON`; 409 with suggestions; **10 concurrent POSTs, one free mentor → 1 × 201, 9 × 409**; **30 parallel → no mentor > 2/IST date, no overlaps**; idempotent replay (sequential + concurrent, same `manageUrl`); active trial (two tabs); cancel via token / owner / admin frees capacity and is idempotent; wrong token → 404; direct overlapping SQL insert → `23P01`                                                                                                                          |
| **Integration: auth**        | same                                                                          | Sign-up 202 for new and existing emails (same body; existing → `ACCOUNT_EXISTS` in Outbox); pending can't sign in (403); verify then sign in → cookie flags (HttpOnly, SameSite=Lax); wrong password and unknown email → identical 401; rate limit → 429; expired/used token → 400; reset ends all sessions; guest booking appears in `/me/bookings` after verify (A1); parent can't read another parent's booking (404); parent session on `/admin/*` → 401/403; admin endpoints return data; `originCheck` blocks a foreign Origin with a cookie; logout invalidates the session |
| **Frontend**                 | `apps/web` (Testing Library + mocked API)                                     | Slots in chosen zone; Full → suggestions; strategy headlines; form validation; 409 keeps form; DST banner; route guards redirect with `next`; login error copy; My bookings tabs; admin table filters                                                                                                                                                                                                                                                                                                                                                                              |
| **E2E (optional)**           | Playwright                                                                    | Guest book → sign up → verify via dev outbox → My bookings shows it → admin sees it on the mentor schedule in India time                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

## 17. Milestones

Each milestone ends with green tests and one commit.

| M   | Deliverable                                                                                                                         | Done when                                                    |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| M0  | Workspaces, TS/ESLint/Prettier, docker-compose, `.env.example`, scripts                                                             | `db:up` + `typecheck` pass                                   |
| M1  | `packages/shared`: time module, schemas, error codes (**tests first**)                                                              | Unit time suite green                                        |
| M2  | Prisma schema + SQL constraints migration + repositories                                                                            | `db:migrate` works; `23P01` test green                       |
| M3  | API skeleton: config, clock, logger, errors, container, `/health`                                                                   | Envelope test green                                          |
| M4  | Slot engine + `GET /slots`                                                                                                          | Unit + property tests; §7.3 fixtures match                   |
| M5  | Suggestions + `GET /slots/suggestions`                                                                                              | Unit suggestions green                                       |
| M6  | Booking create/read/cancel, assignment, manage token, Outbox, `.ics`                                                                | Booking integration (incl. concurrency) green                |
| M7  | Auth: sessions, origin check, parent sign-up/verify/login/forgot/reset/logout, admin login, `/auth/me`, `/me/bookings`, rate limits | Auth integration green                                       |
| M8  | Admin APIs (dashboard, bookings, parents, mentors/schedule, outbox, cancel) + `/dev/outbox`                                         | Admin integration green                                      |
| M9  | Seed (S1–S7)                                                                                                                        | `db:seed` prints logins + references; states visible via API |
| M10 | Web scaffold: Tailwind/shadcn tokens, router, query client, api client, `useAuth`, guards, layouts                                  | App boots; guards redirect                                   |
| M11 | Booking flow + confirmation/manage page                                                                                             | RTL tests green; manual booking works                        |
| M12 | Account pages + My bookings + dev outbox page                                                                                       | Guest → sign up → verify → My bookings works manually        |
| M13 | Admin console pages                                                                                                                 | Admin can browse all data and cancel                         |
| M14 | Polish: empty/error states, a11y, 360 px                                                                                            | Keyboard-only booking; no console errors                     |
| M15 | `README.md` (incl. demo logins), `docs/API.md`, `TRANSCRIPT.md`                                                                     | Fresh clone → running app via README                         |

## 18. Traceability

| PRD                             | Implemented in                                      | Tested by                            |
| ------------------------------- | --------------------------------------------------- | ------------------------------------ |
| FR-1, T8                        | `useTimezone`, `TimezoneBar`, `normalizeZone`       | Unit time; RTL                       |
| FR-2, FR-3, FR-5                | `slotEngine`, `SlotGrid`, `DayStrip`                | Unit slot engine; RTL                |
| FR-4, T11, T13, T14             | `dayWindow`, `slotEngine`, booking pre-check        | Property test; fixtures; integration |
| FR-6, FR-7, C1–C3, C7, C8       | `BookingService`, `AssignmentStrategy`, constraints | Integration booking                  |
| FR-8, FR-10, A6                 | `BookingPage`, manage token, `BookingAccess`        | Unit tokens; integration             |
| FR-9                            | `outboxService`                                     | Integration booking/auth             |
| FR-11, C4, C5, C9, C11          | `suggestions`, `SuggestionsPanel`                   | Unit; integration 409/422; RTL       |
| FR-12                           | parent lock + active check                          | Integration two-tabs                 |
| FR-13, T1–T6, T12               | `upcomingTransitions`, `DstBanner`, time module     | Unit time; RTL                       |
| FR-14–FR-16, A2, A3, A7–A9, A12 | `parentAuthService`, `sessionService`, tokens       | Integration auth                     |
| FR-17, A1, A4, A5               | `/me/bookings`, `BookingAccess`, `MyBookingsPage`   | Integration auth; RTL                |
| FR-18, FR-19, A10               | `adminAuthService`, `adminService`, admin pages     | Integration admin; RTL               |
| FR-20                           | `/dev/outbox`, `DevOutboxPage`                      | Integration (enabled/disabled)       |
| T7, display rules               | `zoneAbbreviation`, `formatZoneLabel`               | Unit time                            |

## 19. Future work

Mentor login (`MENTOR` role, same session layer); real email/WhatsApp provider reading the Outbox; social login / 2FA / email change; admin user management and shift editing; reschedule; mentor time-off; subject/language matching; waitlist with auto-offer on cancellation; per-day slot cache for larger mentor pools; metrics on "no availability" by zone/day to plan shifts.
