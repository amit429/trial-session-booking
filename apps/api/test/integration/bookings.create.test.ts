import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { makeTestApp } from "../helpers/app";
import { resetDb } from "../helpers/db";
import { seedMentors } from "../helpers/factories";

const { app, db } = makeTestApp({ now: "2026-10-20T14:00:00Z" });
afterAll(() => db.$disconnect());

let n = 0;
const body = (startUtc: string, email = `parent${++n}@example.com`, tz = "America/New_York") => ({
  parent: { name: "Jane Doe", email, phone: "+1 555 010 2000" },
  child: { name: "Sam", grade: 4 },
  subject: "CODING",
  startUtc,
  timezone: tz
});
const post = (b: object, key: string = randomUUID()) => request(app).post("/api/bookings").set("Idempotency-Key", key).send(b);

describe("POST /api/bookings", () => {
  beforeEach(async () => { await resetDb(); await seedMentors(db, { allWeek: true }); });

  it("books, assigns a mentor on shift and writes messages in each recipient's zone", async () => {
    const res = await post(body("2026-10-21T19:00:00.000Z"));
    expect(res.status).toBe(201);
    expect(res.body.reference).toMatch(/^CY-/);
    expect(res.body.status).toBe("CONFIRMED");
    expect(res.body.mentor.shiftLabel).toBe("US-East shift");
    expect(res.body.manageUrl).toMatch(new RegExp(`/booking/${res.body.reference}\\?token=`));
    expect(res.body.googleCalendarUrl).toContain("dates=20261021T190000Z/20261021T200000Z");
    const msgs = await db.outboxMessage.findMany({ orderBy: { kind: "asc" } });
    expect(msgs.map(m => m.kind)).toEqual(["BOOKING_CONFIRMED_PARENT", "BOOKING_CONFIRMED_MENTOR"]);
    expect(msgs[0].body).toContain("Wed 21 Oct · 3:00 PM EDT");
    expect(msgs[1].body).toContain("Thu 22 Oct · 12:30 AM IST (India)");
    expect(msgs[1].body).toContain("Parent's time: Wed 21 Oct · 3:00 PM EDT");
  });

  it("is idempotent: the same key returns the same booking", async () => {
    const key = randomUUID();
    const b = body("2026-10-21T19:00:00.000Z");
    const [a, c] = await Promise.all([post(b, key), post(b, key)]);
    expect(a.status).toBe(201);
    expect(c.status).toBe(201);
    expect(c.body.reference).toBe(a.body.reference);
    expect(await db.booking.count()).toBe(1);
  });

  it("treats emails case- and space-insensitively and allows one upcoming trial", async () => {
    expect((await post(body("2026-10-21T19:00:00.000Z", " Jane@Example.com "))).status).toBe(201);
    const res = await post(body("2026-10-22T19:00:00.000Z", "jane@example.com"));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ACTIVE_TRIAL_EXISTS");
    expect(res.body.error.details).toMatchObject({ startUtc: "2026-10-21T19:00:00.000Z", timezone: "America/New_York" });
  });

  it("rejects a time inside a mentor's shift but outside the parent's 8 AM to 9 PM", async () => {
    const res = await post(body("2026-10-21T11:30:00.000Z")); // 7:30 AM EDT = 5:00 PM IST
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("OUTSIDE_HOURS");
    expect(res.body.error.details.suggestions.strategy).toBe("SAME_DAY");
  });

  it("rejects times inside the 2-hour notice with suggestions", async () => {
    const res = await post(body("2026-10-20T15:00:00.000Z"));
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("SLOT_TOO_SOON");
    expect(res.body.error.details.suggestions.suggestions.length).toBeGreaterThan(0);
  });

  it("requires an idempotency key and a valid body", async () => {
    const res = await request(app).post("/api/bookings").send(body("2026-10-21T19:00:00.000Z"));
    expect(res.status).toBe(400);
    const bad = await post({ ...body("2026-10-21T19:00:00.000Z"), child: { name: "", grade: 0 } });
    expect(bad.status).toBe(422);
    expect(bad.body.error.details.fieldErrors["child.grade"]).toBe("Choose a grade between 1 and 12");
  });
});

describe("capacity and concurrency", () => {
  beforeEach(async () => { await resetDb(); await seedMentors(db, { allWeek: true, only: [0] }); }); // one UK-shift mentor

  it("a mentor never takes a third trial on the same IST date", async () => {
    // 21 Oct, London: 2:00 PM, 4:00 PM, 6:00 PM BST = 18:30, 20:30, 22:30 IST
    expect((await post(body("2026-10-21T13:00:00.000Z", undefined, "Europe/London"))).status).toBe(201);
    expect((await post(body("2026-10-21T15:00:00.000Z", undefined, "Europe/London"))).status).toBe(201);
    const third = await post(body("2026-10-21T17:00:00.000Z", undefined, "Europe/London"));
    expect(third.status).toBe(409);
    expect(third.body.error.code).toBe("SLOT_UNAVAILABLE");
  });

  it("10 parents racing for the last mentor: exactly one wins, the rest get suggestions", async () => {
    const results = await Promise.all(Array.from({ length: 10 }, () => post(body("2026-10-21T13:00:00.000Z", undefined, "Europe/London"))));
    const codes = results.map(r => r.status).sort();
    expect(codes).toEqual([201, 409, 409, 409, 409, 409, 409, 409, 409, 409]);
    for (const r of results.filter(x => x.status === 409)) {
      expect(r.body.error.code).toBe("SLOT_UNAVAILABLE");
      expect(r.body.error.details.suggestions).toBeDefined();
    }
    expect(await db.booking.count()).toBe(1);
  });
});

describe("parallel load across a day", () => {
  beforeEach(async () => { await resetDb(); await seedMentors(db, { allWeek: true }); });

  it("30 parallel bookings never exceed 2 per mentor per IST date and never overlap", async () => {
    const slots = (await request(app).get("/api/slots").query({ tz: "America/New_York", from: "2026-10-22", days: 1 })).body.days[0].slots;
    const results = await Promise.all(Array.from({ length: 30 }, (_, i) => post(body(slots[i % slots.length].startUtc))));
    expect(results.every(r => r.status === 201 || r.status === 409)).toBe(true);
    const rows = await db.booking.findMany({ where: { status: "CONFIRMED" } });
    const perDay = new Map<string, number>();
    for (const b of rows) {
      const k = `${b.mentorId}|${b.mentorLocalDate.toISOString()}`;
      perDay.set(k, (perDay.get(k) ?? 0) + 1);
    }
    expect(Math.max(...perDay.values())).toBeLessThanOrEqual(2);
    for (const a of rows) for (const b of rows) {
      if (a.id !== b.id && a.mentorId === b.mentorId) expect(a.startUtc < b.endUtc && b.startUtc < a.endUtc).toBe(false);
    }
    expect(rows.length).toBe(results.filter(r => r.status === 201).length);
  });
});
