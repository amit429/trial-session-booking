# Trial-Class Booking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A working web app where US/UK parents book a free trial class, a free mentor in India is assigned atomically (≤ 2 trials per mentor per IST date), times are DST-correct, unavailable times lead to suggestions, parents can optionally sign up to see their bookings, and an admin console shows everything.

**Architecture:** npm-workspaces monorepo. `packages/shared` holds the Luxon time module, zod schemas and error codes. `apps/api` is Express + Prisma on PostgreSQL. Slots are computed per request by a pure slot engine; bookings use a short locking transaction plus an `EXCLUDE` constraint. `apps/web` is Vite + React + TanStack Query, styled like shadcn/ui (Tailwind v4 + Radix).

**Tech Stack:** Node 22+ (dev machine runs 26), TypeScript 5 strict, Express 5, Prisma 6, PostgreSQL 16 (docker-compose), Luxon 3, zod 3, Vitest 3, supertest, fast-check, @node-rs/argon2, React 18, Vite 6, Tailwind v4, Radix UI, TanStack Query 5, react-router 6, react-hook-form.

**Spec:** `docs/PRD.md`, `docs/TECHNICAL_DESIGN.md`, visual reference `docs/ui-prototype.html`.

## Global Constraints

- Class 60 min; grid 30 min (UTC-aligned); notice 120 min; horizon 14 days; cap 2 per mentor per IST date.
- Parent window 08:00–21:00 parent-local, evaluated per local date. Mentor availability = their shift rules only; no global IST cap.
- All instants `timestamptz` UTC; zones are IANA names; never fixed offsets.
- Never display a bare "IST": `IST (India)` short, `India Standard Time (UTC+05:30)` long; London BST/GMT; Dublin GMT+1/GMT.
- Error envelope `{ error: { code, message, details? } }` with codes from Technical Design §11.2.
- Ownership failures return 404, never 403.
- Booking needs no account; manage token = base64url HMAC-SHA256(`APP_SECRET`, `"manage:" + bookingId`).
- Sessions: random 32-byte id in httpOnly SameSite=Lax cookie (`cy_parent_sid`, `cy_admin_sid`), SHA-256 stored.
- Copy: plain, active voice, no em-dash asides; button text says what happens.
- Commit after every task with a meaningful message; push to `origin main`.

## Review Focus

1. **Concurrent booking of the last mentor**: exactly one 201; the rest 409 with suggestions (Task 9 concurrency test).
2. **Same local time across a DST change** maps to different UTC instants and suggestions still match the parent's clock (Task 7 test).
3. **Booking without trailing slash / extra whitespace / mixed-case email** is treated as the same parent (Task 9 test on `" Jane@Example.com "`).
4. **Signed-in parent opening someone else's booking URL** gets 404, and a parent cookie never unlocks `/api/admin/*` (Task 11 test).
5. **Request for a slot inside a mentor's shift but outside the parent window** (e.g. 7:30 AM local) is rejected with `OUTSIDE_HOURS` (Task 9 test).

---

## File Structure

```
package.json · tsconfig.base.json · docker-compose.yml · .env.example · .gitignore · README.md · TRANSCRIPT.md
packages/shared/src/
  index.ts
  errors.ts                    ErrorCode, ERROR_MESSAGES
  schemas.ts                   zod request/response schemas + DTO types
  time/zones.ts                normalizeZone, PINNED_ZONES, ZONE_NAMES
  time/windows.ts              dayWindow, localDayWindow, localClockMinutes, localDate, addDays
  time/grid.ts                 gridStarts
  time/rules.ts                expandRules
  time/format.ts               zoneAbbreviation, formatZoneLabel, formatSlot, formatTime, formatDayLong, timeOfDayGroup, formatOffset
  time/transitions.ts          upcomingTransitions
  time/index.ts
apps/api/
  prisma/schema.prisma · prisma/migrations/* · prisma/seed.ts
  src/config.ts · clock.ts · app.ts · server.ts · container.ts · db.ts
  src/http/errors.ts           AppError, errorHandler, notFound
  src/http/session.ts          loadSession, requireParent, requireAdmin
  src/http/originCheck.ts · rateLimit.ts · cookies.ts · validate.ts
  src/domain/slotEngine.ts     buildSlots
  src/domain/suggestions.ts    rankSuggestions
  src/domain/assignment.ts     rankMentors
  src/domain/tokens.ts         newToken, hashToken, manageToken, verifyManageToken
  src/domain/reference.ts      newReference
  src/services/slotService.ts · suggestionService.ts · bookingService.ts · outboxService.ts
  src/services/calendarService.ts · sessionService.ts · parentAuthService.ts · adminAuthService.ts · adminService.ts
  src/routes/health.ts · slots.ts · bookings.ts · auth.ts · me.ts · admin.ts · dev.ts
  test/helpers/db.ts · test/helpers/factories.ts · test/helpers/app.ts
  test/unit/*.test.ts · test/integration/*.test.ts
apps/web/
  index.html · vite.config.ts · src/main.tsx · src/index.css
  src/lib/api.ts · utils.ts · useTimezone.ts · auth.ts
  src/components/ui/*          button, input, label, select, card, badge, alert, tabs, dialog, dropdown-menu, popover, sheet, toaster
  src/components/AppShell.tsx · AdminShell.tsx · RequireParent.tsx · RequireAdmin.tsx
  src/features/booking/*       BookPage, InfoPane, MonthCalendar, TimesPane, Suggestions, DetailsForm, TimezonePicker
  src/features/booking-view/*  BookingPage
  src/features/account/*       SignupPage, LoginPage, VerifyEmailPage, ForgotPasswordPage, ResetPasswordPage, MyBookingsPage
  src/features/admin/*         AdminLoginPage, DashboardPage, BookingsPage, BookingSheet, ParentsPage, ParentDetailPage, MentorsPage, MentorDetailPage, OutboxPage
  src/features/dev/DevOutboxPage.tsx
docs/API.md
```

---

### Task 1: Monorepo scaffold, Docker Postgres, public GitHub repo

**Files:** Create `package.json`, `tsconfig.base.json`, `.gitignore`, `.env.example`, `docker-compose.yml`, `packages/shared/package.json`, `packages/shared/tsconfig.json`, `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/vitest.config.ts`.

**Interfaces:** Produces root scripts `dev`, `build`, `test`, `test:unit`, `test:integration`, `typecheck`, `db:up`, `db:migrate`, `db:seed`, `db:reset`.

- [ ] Write root `package.json` with `"workspaces": ["packages/*","apps/*"]` and the scripts above (delegating with `npm run <x> -w <ws>`).
- [ ] `docker-compose.yml`: `db` (postgres:16-alpine, 5432, volume) and `db-test` (postgres:16-alpine, 5433, tmpfs).
- [ ] `.gitignore`: node_modules, dist, .env, coverage, `*.pdf` (keep the assignment PDF out of the public repo).
- [ ] `npm install`; `npm run db:up`; `docker compose ps` shows both healthy.
- [ ] `gh repo create trial-session-booking --public --source . --push`; commit "chore: scaffold monorepo with docker postgres".

### Task 2: Shared time module (TDD)

**Files:** `packages/shared/src/time/*.ts`, `packages/shared/test/time.test.ts`.

**Interfaces (Produces):**

```ts
normalizeZone(zone: string): string                       // throws InvalidZoneError
addDays(isoDate: string, n: number): string
localDate(instant: Date | number, zone: string): string    // "YYYY-MM-DD"
localClockMinutes(instant, zone): number
dayWindow(isoDate, zone, startMin, endMin): { start: Date; end: Date }
localDayWindow(isoDate, zone): { start: Date; end: Date }
gridStarts(start: Date, end: Date, stepMin: number): Date[]
expandRules(rules: {weekday:number; startMinute:number; endMinute:number}[], zone, from: Date, to: Date): {start: Date; end: Date}[]
zoneAbbreviation(zone, instant): string
formatOffset(offsetMinutes: number): string                // "UTC−04:00"
formatZoneLabel(zone, instant): string
formatTime(instant, zone, h24?: boolean): string           // "3:00 PM"
formatDay(instant, zone): string                           // "Sat 31 Oct"
formatDayLong(instant, zone): string                       // "Saturday 31 October"
formatSlot(instant, zone): string                          // "Sat 31 Oct · 3:00 PM EDT"
timeOfDayGroup(instant, zone): "morning" | "afternoon" | "evening"
upcomingTransitions(zone, fromDate: string, days: number): { date: string; at: Date; fromOffset: number; toOffset: number; back: boolean }[]
PINNED_ZONES: string[]; ZONE_NAMES: Record<string,string>
```

- [ ] Tests first (`vitest`):
  - NY 2026-11-01 `localDayWindow` = 25 h; NY 2027-03-14 = 23 h.
  - `formatSlot(2026-10-31T12:30Z, NY)` = `Sat 31 Oct · 8:30 AM EDT`; `2026-11-02T13:30Z` → `Mon 2 Nov · 8:30 AM EST`.
  - 18:00 IST on 2026-10-20 → London `1:30 PM BST`; on 2026-10-27 → `12:30 PM GMT`; Dublin summer → `GMT+1`; Kolkata → `IST (India)`; label Kolkata → `India Standard Time (UTC+05:30)`.
  - `normalizeZone("Asia/Calcutta")` = `Asia/Kolkata`; `"US/Eastern"` → `America/New_York`; `"Mars/Base"` throws.
  - Repeated hour: 2026-11-01T05:30Z and 06:30Z in NY → `1:30 AM EDT` / `1:30 AM EST`.
  - `expandRules` weekday 3 (Wed) 00:30–07:30 in Kolkata over 2026-10-20..22 returns the Wed 21 Oct interval `2026-10-20T19:00Z–2026-10-21T02:00Z`.
  - `expandRules` in America/New_York for a 02:00–04:00 Sunday rule on 2027-03-14 starts at 03:00 EDT (gap shifts forward).
  - `upcomingTransitions("America/New_York","2026-10-20",14)` → one entry on `2026-11-01`, back = true.
- [ ] Run, see failures; implement with Luxon; run green; commit "feat(shared): DST-safe time module".

### Task 3: Shared schemas and error codes

**Files:** `packages/shared/src/errors.ts`, `schemas.ts`, `index.ts`, `packages/shared/test/schemas.test.ts`.

**Interfaces (Produces):** `ErrorCode` union (`VALIDATION | SLOT_TOO_SOON | OUTSIDE_HOURS | SLOT_UNAVAILABLE | ACTIVE_TRIAL_EXISTS | NOT_FOUND | ALREADY_STARTED | UNAUTHENTICATED | FORBIDDEN | INVALID_CREDENTIALS | EMAIL_NOT_VERIFIED | TOKEN_INVALID | ORIGIN_MISMATCH | RATE_LIMITED | INTERNAL`), `ERROR_MESSAGES`, zod `CreateBookingRequest`, `SignupRequest`, `LoginRequest`, `EmailRequest`, `TokenRequest`, `ResetPasswordRequest`, `SlotsQuery`, `SuggestionsQuery`, types `SlotDto`, `DaySlotsDto`, `SlotsResponse`, `SuggestionsResponse`, `BookingDto`, `ParentDto`, `AdminBookingDto`, `OutboxDto`.

- [ ] Tests: email trimmed + lowercased; grade 0 rejected with "Choose a grade between 1 and 12"; `startUtc` `"2026-10-20T19:15:00.000Z"` rejected "Please pick a time from the list"; password equal to email rejected.
- [ ] Implement; green; commit "feat(shared): request schemas and error catalogue".

### Task 4: Prisma schema, constraints migration, test DB helpers

**Files:** `apps/api/prisma/schema.prisma` (exactly Technical Design §6.1), migration SQL with §6.2 constraints appended, `apps/api/src/db.ts`, `apps/api/test/helpers/db.ts`, `apps/api/test/integration/constraints.test.ts`.

**Interfaces (Produces):** `prisma` client singleton (`db.ts`), `resetDb(prisma)` truncating all tables, `makeMentor(prisma, overrides)`.

- [ ] `prisma migrate dev --name init --create-only`, append constraint SQL, apply; also apply to test DB via `DATABASE_URL=$TEST_DATABASE_URL prisma migrate deploy` in vitest globalSetup.
- [ ] Test: inserting two CONFIRMED bookings for one mentor overlapping by 30 min throws Prisma error with `23P01`; a CANCELLED one overlapping is allowed.
- [ ] Commit "feat(api): data model with overlap exclusion constraint".

### Task 5: API skeleton

**Files:** `src/config.ts`, `clock.ts`, `http/errors.ts`, `http/validate.ts`, `app.ts`, `server.ts`, `container.ts`, `routes/health.ts`, `test/helpers/app.ts`, `test/integration/health.test.ts`.

**Interfaces (Produces):**

```ts
interface Clock { now(): Date }  class SystemClock; class FixedClock { constructor(d: Date); set(d: Date) }
loadConfig(env): Config        // zod-parsed (Technical Design §14)
class AppError extends Error { constructor(code: ErrorCode, status: number, message?: string, details?: unknown) }
buildContainer({ prisma, clock, config }): Container
createApp(container): express.Express
```

- [ ] Tests: `GET /api/health` → `{status:"ok", db:"ok"}`; unknown route → 404 envelope `NOT_FOUND`; thrown generic error → 500 `INTERNAL` without stack.
- [ ] Commit "feat(api): express skeleton with config, clock and error envelope".

### Task 6: Slot engine (pure)

**Files:** `src/domain/slotEngine.ts`, `test/unit/slotEngine.test.ts`.

**Interfaces:**

```ts
type EngineMentor = { id: string; timezone: string; maxDailyTrials: number; rules: Rule[] };
type EngineBooking = { mentorId: string; startUtc: Date; endUtc: Date; mentorLocalDate: string };
type SlotStatus = "OPEN" | "FULL";
type Slot = { startUtc: Date; endUtc: Date; status: SlotStatus; availableMentors: number; availableMentorIds: string[] };
type Day = { date: string; status: "OPEN" | "FULL" | "CLOSED"; slots: Slot[] };
buildSlots(input: { parentTz; fromDate; days; now: Date; config: EngineConfig; mentors: EngineMentor[]; bookings: EngineBooking[] }): Day[]
availableMentorsAt(start: Date, input): EngineMentor[]   // used by booking pre-check
isInParentWindow(start: Date, parentTz, config): boolean
```

- [ ] Tests:
  - Fixture: 10 seed mentors (Technical Design §15) and no bookings, `now = 2026-10-20T00:00Z`. New York on 2026-10-20 offers starts 8:00 AM–1:00 PM and 3:00–8:00 PM EDT; on 2026-11-10 8:00 AM–12:00 PM and 2:00–8:00 PM EST; London 2026-11-10 8:00 AM–5:00 PM plus 7:00–8:00 PM GMT (use days where every mentor works, e.g. compute with all mentors' `off` removed).
  - Cap: two bookings for mentor A on an IST date → A not in `availableMentorIds` for any other slot that date.
  - Overlap: booking 19:00–20:00Z blocks 18:30Z and 19:30Z starts for that mentor.
  - Notice: nothing earlier than now + 120 min.
  - Property (fast-check, 200 runs): random zone from PINNED_ZONES, random date in 60 days, random bookings → every returned slot is inside the parent window and every OPEN slot has ≥ 1 mentor whose shift covers it and is under cap.
- [ ] Commit "feat(api): pure slot engine with per-day windows".

### Task 7: Suggestion ranking (pure)

**Files:** `src/domain/suggestions.ts`, `test/unit/suggestions.test.ts`.

**Interfaces:** `rankSuggestions(days: Day[], D: string, T: number, tz: string, limits = {sameDay:4,sameTime:3,nearest:4}, excludeStart?: Date): { strategy: "SAME_DAY"|"SAME_TIME"|"NEAREST"|"NONE"; requested:{date,time,timezone}; suggestions: Slot[]; notes: {type:"DST_SHIFT"; message:string}[] }`

- [ ] Tests with hand-built `Day[]`: SAME_DAY ordering by distance then earlier; FULL day → SAME_TIME nearest days, ties later; T missing → NEAREST ≤ 2 per day ≤ 4; nothing → NONE; DST: a 9:00 AM slot before and after 2026-11-01 in NY are different UTC instants and both match T = 540.
- [ ] Commit "feat(api): suggestion cascade".

### Task 8: Slot and suggestion endpoints

**Files:** `src/services/slotService.ts`, `suggestionService.ts`, `src/routes/slots.ts`, `test/integration/slots.test.ts`, `test/helpers/factories.ts` (`seedMentors(prisma)` creating the 10 §15 mentors + rules).

**Interfaces:** `SlotService.getDays(tz, fromDate, days): Promise<Day[]>`, `SlotService.engineInput(range)`, `SuggestionService.suggest(tz, D, T, exclude?)`.

- [ ] Tests: `GET /api/slots?tz=America/New_York&from=2026-10-20&days=1` with FixedClock returns OPEN slots with ISO strings; bad tz → 422 `VALIDATION`; `GET /api/slots/suggestions?tz=…&date=…&time=09:00` returns a strategy.
- [ ] Commit "feat(api): slots and suggestions endpoints".

### Task 9: Booking creation

**Files:** `src/domain/assignment.ts`, `tokens.ts`, `reference.ts`, `src/services/outboxService.ts`, `bookingService.ts`, `src/routes/bookings.ts`, `test/unit/assignment.test.ts`, `test/unit/tokens.test.ts`, `test/integration/bookings.create.test.ts`.

**Interfaces:**

```ts
rankMentors(candidates: EngineMentor[], start: Date, input): EngineMentor[]
newToken(): string; hashToken(t: string): string
manageToken(secret: string, bookingId: string): string; verifyManageToken(secret, bookingId, token): boolean
newReference(): string                                  // CY-XXXXXX
BookingService.create(req: CreateBookingRequest, idemKey: string, sessionParentEmail?: string): Promise<BookingDto>
toBookingDto(booking (with mentor), config): BookingDto // includes manageUrl, googleCalendarUrl
```

- [ ] Tests: happy path 201 with mentor + manageUrl + 2 outbox rows rendered in parent/mentor zones; same idempotency key twice → same reference; `" Jane@Example.com "` twice with different keys → second is 409 `ACTIVE_TRIAL_EXISTS`; 7:30 AM NY slot → 422 `OUTSIDE_HOURS`; slot < 2 h → 422 `SLOT_TOO_SOON` with suggestions; 3rd booking for the only mentor on an IST date fails; **10 concurrent POSTs** with one available mentor → 1×201, 9×409 with `details.suggestions`; **30 parallel** bookings across a day → no mentor > 2 per IST date and no overlaps.
- [ ] Commit "feat(api): atomic booking with assignment, idempotency and outbox".

### Task 10: Booking read, cancel, calendar

**Files:** `src/services/calendarService.ts`, extend `bookingService.ts` (`getForViewer`, `cancel`), `routes/bookings.ts`, `test/integration/bookings.manage.test.ts`.

- [ ] Tests: GET with token → 200; wrong token → 404; cancel → CANCELLED + 2 outbox rows, slot open again; cancel twice → 200 same; cancel after start → 422 `ALREADY_STARTED`; `.ics` has `DTSTART:…Z`.
- [ ] Commit "feat(api): manage link view, cancel and ics".

### Task 11: Auth and sessions

**Files:** `src/http/cookies.ts`, `session.ts`, `originCheck.ts`, `rateLimit.ts`, `src/services/sessionService.ts`, `parentAuthService.ts`, `adminAuthService.ts`, `src/routes/auth.ts`, `src/routes/me.ts`, `test/integration/auth.test.ts`.

**Interfaces:** `SessionService.create(kind, subjectId) → rawToken`, `.resolve(raw, kind)`, `.destroy(raw)`, `.destroyAllForParent(id)`; middleware sets `req.auth = { parent?: Parent; admin?: AdminUser }`.

- [ ] Tests: sign-up new and existing emails both 202 (existing → `ACCOUNT_EXISTS` outbox); pending login 403 `EMAIL_NOT_VERIFIED`; verify then login sets `cy_parent_sid` HttpOnly SameSite=Lax; unknown email and wrong password both 401 identical body; 6th attempt 429; used verify token 400; reset ends sessions; guest booking appears in `/api/me/bookings` after verify; parent cookie on another parent's booking → 404; parent cookie on `/api/admin/dashboard` → 401; cookie + `Origin: https://evil.example` POST → 403 `ORIGIN_MISMATCH`.
- [ ] Commit "feat(api): parent accounts, admin login and sessions".

### Task 12: Admin and dev endpoints

**Files:** `src/services/adminService.ts`, `src/routes/admin.ts`, `src/routes/dev.ts`, `test/integration/admin.test.ts`.

- [ ] Tests: dashboard capacity per IST date = working mentors × 2; bookings filter by status/mentor/q; parents list statuses; mentor schedule shows `booked/max` per date; admin cancel writes "by our team" outbox; `/api/dev/outbox` 404 when disabled.
- [ ] Commit "feat(api): admin console and dev outbox endpoints".

### Task 13: Seed

**Files:** `prisma/seed.ts`.

- [ ] Admin from env; 10 mentors (§15 table); scenarios S1–S7 via `BookingService` with `FixedClock`; prints logins and references.
- [ ] Run `npm run db:reset && npm run db:seed`; `curl /api/slots` shows a FULL slot on day+2 9:30 AM NY.
- [ ] Commit "feat(api): seed mentors, demo accounts and edge-case bookings".

### Task 14: Web scaffold and design system

**Files:** `apps/web/*` scaffold, `src/index.css` (tokens from Technical Design §13 / prototype), `src/components/ui/*`, `src/lib/api.ts`, `utils.ts`, `auth.ts`, `useTimezone.ts`, `AppShell.tsx`, `AdminShell.tsx`, guards, router in `main.tsx`.

**Interfaces:** `api.get<T>(path)`, `api.post<T>(path, body, headers?)` throwing `ApiError {status, code, message, details}`; `useAuth()` → `{ parent, admin, refresh }`; `useTimezone()` → `[tz | null, setTz, detected]`.

- [ ] `npm run build -w apps/web` passes; dev server proxies `/api` to :4000.
- [ ] Commit "feat(web): app shell, routing and shadcn-style components".

### Task 15: Booking flow

**Files:** `src/features/booking/*`, `src/features/booking/__tests__/booking.test.tsx`.

- [ ] Three-pane booker exactly as in the prototype: info pane with time-zone combobox and DST alert; month calendar with dots; times list with 12h/24h; FULL times and FULL days show suggestions; details form with subject cards; submit with `Idempotency-Key`; 409/422 → suggestions; `ACTIVE_TRIAL_EXISTS` → info alert.
- [ ] RTL tests: FULL slot click renders "is taken" headline; validation messages on empty submit.
- [ ] Commit "feat(web): calendar booking flow with suggestions".

### Task 16: Booking page (confirmation / manage)

**Files:** `src/features/booking-view/BookingPage.tsx`.

- [ ] Success hero, What/When/Mentor/Parent/Where/Reference rows, travelling note, copy link, Google + .ics, cancel AlertDialog, manage-link card, create-account card for guests; cancelled/completed/not-found states.
- [ ] Commit "feat(web): confirmation and manage page".

### Task 17: Account pages and My bookings

**Files:** `src/features/account/*`, `src/features/dev/DevOutboxPage.tsx`.

- [ ] Signup → check email; verify (success / expired + resend); login with all three alerts; forgot / reset; My bookings tabs with cancel; dev outbox with clickable links (rewritten to app routes).
- [ ] Commit "feat(web): parent accounts, my bookings and dev outbox".

### Task 18: Admin console

**Files:** `src/features/admin/*`.

- [ ] Sidebar + breadcrumb layout; dashboard stats + SVG bar chart; bookings table with search/filters/row menu/sheet/cancel; parents list + detail; mentor cards + schedule; outbox.
- [ ] Commit "feat(web): admin console".

### Task 19: Docs and final verification

**Files:** `README.md`, `docs/API.md`, `TRANSCRIPT.md`.

- [ ] README: prerequisites, setup (`cp .env.example .env`, `npm install`, `npm run db:up`, `npm run db:migrate`, `npm run db:seed`, `npm run dev`), demo logins, tests, architecture summary, assumptions, trade-offs, manual test script for DST/concurrency/edge cases.
- [ ] API.md: every endpoint with example request/response and error codes.
- [ ] TRANSCRIPT.md: prompts and agent responses of the AI-assisted sessions.
- [ ] `npm run typecheck && npm test && npm run build` all green; commit "docs: README, API reference and AI transcript"; push.
