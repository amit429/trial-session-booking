# API reference

Base URL: `/api` (the web dev server proxies it to `http://localhost:4000`). JSON in and out. Instants are ISO-8601 UTC strings; zones are IANA names.

**Errors** always use one envelope:

```json
{ "error": { "code": "SLOT_UNAVAILABLE", "message": "That time was just booked.", "details": { } } }
```

| Code | HTTP | When | `details` |
|---|---|---|---|
| `VALIDATION` | 400 / 422 | Bad header, body or query | `{ fieldErrors: { "parent.email": "Please enter a valid email" } }` |
| `SLOT_TOO_SOON` | 422 | Start is less than 2 hours away | `{ suggestions }` |
| `OUTSIDE_HOURS` | 422 | Outside 08:00–21:00 parent-local or outside every mentor's shift | `{ suggestions }` |
| `SLOT_UNAVAILABLE` | 409 | No mentor could take it (lost race, full) | `{ suggestions }` |
| `ACTIVE_TRIAL_EXISTS` | 409 | Email already has an upcoming trial | `{ reference, startUtc, timezone }` |
| `NOT_FOUND` | 404 | Unknown, or you aren't allowed to see it | — |
| `ALREADY_STARTED` | 422 | Cancel after the class started | — |
| `UNAUTHENTICATED` | 401 | No or expired session | — |
| `INVALID_CREDENTIALS` | 401 | Wrong email or password (same for unknown emails) | — |
| `EMAIL_NOT_VERIFIED` | 403 | Correct password, email not verified | — |
| `TOKEN_INVALID` | 400 | Verification/reset link expired or used | — |
| `ORIGIN_MISMATCH` | 403 | Cookie-bearing write from another origin | — |
| `RATE_LIMITED` | 429 | Too many attempts (bookings 10/min/IP; auth 5/min/IP+email) | — |
| `INTERNAL` | 500 | Unexpected; logged server-side | — |

**Sessions** are httpOnly `SameSite=Lax` cookies: `cy_parent_sid` (7 days, sliding) and `cy_admin_sid` (12 hours). A state-changing request that carries a session cookie must come from `APP_BASE_URL`.

---

## Health

`GET /health` → `200 { "status": "ok", "db": "ok" }` (503 if the database is unreachable).

## Slots

### `GET /slots?tz&from&days`

| Param | Required | Notes |
|---|---|---|
| `tz` | yes | IANA zone; aliases like `Asia/Calcutta` and `US/Eastern` are accepted |
| `from` | no | `YYYY-MM-DD`, parent-local; defaults to today (earlier dates clamp to today) |
| `days` | no | 1–14, default 14 |

```json
{
  "timezone": "America/New_York",
  "meta": { "today": "2026-10-20", "horizonDays": 14, "minNoticeMinutes": 120, "classDurationMinutes": 60 },
  "days": [{
    "date": "2026-10-20",
    "status": "OPEN",
    "slots": [
      { "startUtc": "2026-10-20T16:00:00.000Z", "endUtc": "2026-10-20T17:00:00.000Z", "status": "OPEN", "availableMentors": 4 },
      { "startUtc": "2026-10-20T16:30:00.000Z", "endUtc": "2026-10-20T17:30:00.000Z", "status": "FULL", "availableMentors": 0 }
    ]
  }],
  "transitions": [{ "date": "2026-11-01", "atUtc": "2026-11-01T17:00:00.000Z", "fromOffset": -240, "toOffset": -300, "back": true }]
}
```

- Day `status` is `OPEN` (at least one open slot), `FULL` (mentors on shift but none free), or `CLOSED` (nobody on shift at family-friendly hours).
- Times with no mentor on shift are omitted.

### `GET /slots/suggestions?tz&date&time`

`date` = parent-local `YYYY-MM-DD`; `time` = `HH:mm` on the half hour.

```json
{
  "strategy": "SAME_DAY",
  "requested": { "date": "2026-10-21", "time": "14:00", "timezone": "America/New_York" },
  "suggestions": [{ "startUtc": "2026-10-21T18:30:00.000Z", "endUtc": "2026-10-21T19:30:00.000Z", "status": "OPEN", "availableMentors": 2 }],
  "notes": []
}
```

The cascade stops at the first step that finds something:
1. `SAME_DAY`: up to 4 slots on that day, closest to the requested time.
2. `SAME_TIME`: up to 3 nearby days where the same local clock time is open.
3. `NEAREST`: up to 4 slots, at most 2 per day.
4. `NONE`: nothing open.

`notes` explain clock-change effects.

## Bookings

### `POST /bookings`

Header `Idempotency-Key: <uuid>` (required). Body:

```json
{
  "parent": { "name": "Jane Doe", "email": "jane@example.com", "phone": "+1 555 010 2000" },
  "child": { "name": "Sam", "grade": 4 },
  "subject": "CODING",
  "startUtc": "2026-10-21T19:00:00.000Z",
  "timezone": "America/New_York"
}
```

`201 Created` (a replay with the same key returns the same booking):

```json
{
  "reference": "CY-7K3P9Q",
  "status": "CONFIRMED",
  "startUtc": "2026-10-21T19:00:00.000Z",
  "endUtc": "2026-10-21T20:00:00.000Z",
  "parentTimezone": "America/New_York",
  "mentorTimezone": "Asia/Kolkata",
  "meetingUrl": "https://meet.trialdesk.example/trial/CY-7K3P9Q-x8Jd02LmQa",
  "manageUrl": "http://localhost:5173/booking/CY-7K3P9Q?token=…",
  "googleCalendarUrl": "https://calendar.google.com/calendar/render?action=TEMPLATE&…&dates=20261021T190000Z/20261021T200000Z",
  "subject": "CODING",
  "child": { "name": "Sam", "grade": 4 },
  "parent": { "name": "Jane Doe", "email": "jane@example.com" },
  "mentor": { "id": "…", "name": "Vikram Nair", "bio": "…", "shiftLabel": "US-East shift", "timezone": "Asia/Kolkata" },
  "cancelledAt": null,
  "cancelledBy": null,
  "createdAt": "2026-10-20T14:00:00.000Z"
}
```

`409 SLOT_UNAVAILABLE` example:

```json
{ "error": { "code": "SLOT_UNAVAILABLE", "message": "That time was just booked.",
  "details": { "suggestions": { "strategy": "SAME_DAY", "requested": { "date": "2026-10-21", "time": "15:00", "timezone": "America/New_York" }, "suggestions": [ … ], "notes": [] } } } }
```

If a parent session is present, `parent.email` must be the account email.

### `GET /bookings/:reference?token=`

Visible to:
- the holder of the private `token` (from `manageUrl`);
- the booking's verified parent (session);
- an admin.

Anyone else gets `404`. Returns `BookingDto`.

### `POST /bookings/:reference/cancel`

Body `{ "token": "…" }` (or a session). Returns the cancelled `BookingDto`.
- Idempotent: cancelling twice returns the same result.
- After the class starts: `422 ALREADY_STARTED`.
- Writes cancellation messages to the parent and the mentor.

### `GET /bookings/:reference/calendar.ics?token=`

`text/calendar` RFC 5545 event with `DTSTART`/`DTEND` in UTC.

## Parent accounts

| Method | Path | Body | Success | Errors |
|---|---|---|---|---|
| GET | `/auth/me` | — | `{ parent: ParentDto \| null, admin: AdminDto \| null }` | — |
| POST | `/auth/parent/signup` | `{ name, email, password }` | `202 { message: "Check your email." }` for new **and** existing emails | 422, 429 |
| POST | `/auth/parent/resend-verification` | `{ email }` | 202 | 429 |
| POST | `/auth/parent/verify` | `{ token }` | 200 | `400 TOKEN_INVALID` |
| POST | `/auth/parent/login` | `{ email, password }` | `200 { parent }` + `cy_parent_sid` | 401, 403, 429 |
| POST | `/auth/parent/forgot-password` | `{ email }` | 202 (always) | 429 |
| POST | `/auth/parent/reset-password` | `{ token, password }` | 200; ends all sessions; marks email verified | 400, 422 |
| POST | `/auth/parent/logout` | — | 204 | — |
| GET | `/me/bookings?scope=upcoming\|past\|all` | — | `BookingDto[]` | 401, 403 |

`ParentDto = { id, name, email, timezone, status: "GUEST" | "PENDING" | "VERIFIED" }`.

Notes on account behaviour:
- **Existing verified email at sign-up:** nothing changes. The outbox gets an "already have an account" email for the real owner.
- **Sign-up for a guest email:** links that email's earlier guest bookings to the account once it is verified.

## Admin (admin session required)

| Method | Path | Returns |
|---|---|---|
| POST | `/auth/admin/login` `{ email, password }` | `{ admin }` + `cy_admin_sid` |
| POST | `/auth/admin/logout` | 204 |
| GET | `/admin/dashboard?days=14` | `{ today, todayCount, next7DaysCount, capacity: [{ istDate, booked, capacity }], fullyBookedIstDates }`. Capacity per India date = mentors on shift that weekday × their daily cap |
| GET | `/admin/bookings?scope&status&mentorId&q&page&pageSize` | `{ items: AdminBookingDto[], total }`. `q` matches reference, child, parent name or email |
| GET | `/admin/bookings/:reference` | `AdminBookingDto & { messages: OutboxDto[] }` |
| POST | `/admin/bookings/:reference/cancel` | `AdminBookingDto` (`cancelledBy: "ADMIN"`; messages say "by our team") |
| GET | `/admin/parents?q&page&pageSize` | `{ items: [{ id, name, email, phone, timezone, status, bookingCount, upcomingCount }], total }` |
| GET | `/admin/parents/:id` | `{ parent, bookings: AdminBookingDto[] }` |
| GET | `/admin/mentors` | `[{ id, name, email, bio, shiftLabel, timezone, maxDailyTrials, weeklyShift: [{ weekday, start, end }], onShiftToday, todayBooked, upcomingCount }]` |
| GET | `/admin/mentors/:id/schedule?from&days` | `{ mentor, weeklyShift, days: [{ istDate, onShift, booked, max, bookings }] }` |
| GET | `/admin/outbox?page&pageSize` | `{ items: OutboxDto[], total }` |

`AdminBookingDto = BookingDto & { id, mentorLocalDate, parentStatus }`.
`OutboxDto = { id, kind, toEmail, subject, body, bookingReference, createdAt }`.

## Development

`GET /dev/outbox?limit=50` → `OutboxDto[]`, newest first. Returns `404` unless `DEV_OUTBOX_ENABLED=true`.
