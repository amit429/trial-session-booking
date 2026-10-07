import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeTestApp } from "../helpers/app";
import { resetDb } from "../helpers/db";
import { seedMentors } from "../helpers/factories";

describe("GET /api/slots", () => {
  const { app, db } = makeTestApp({ now: "2026-10-20T14:00:00Z" });
  beforeAll(async () => { await resetDb(); await seedMentors(db, { allWeek: true }); });
  afterAll(() => db.$disconnect());

  it("returns parent-local days with ISO instants, respecting notice", async () => {
    const res = await request(app).get("/api/slots").query({ tz: "America/New_York", from: "2026-10-20", days: 1 });
    expect(res.status).toBe(200);
    expect(res.body.timezone).toBe("America/New_York");
    expect(res.body.meta).toMatchObject({ today: "2026-10-20", horizonDays: 14, minNoticeMinutes: 120, classDurationMinutes: 60 });
    const [day] = res.body.days;
    expect(day.date).toBe("2026-10-20");
    expect(day.slots[0]).toEqual({ startUtc: "2026-10-20T16:00:00.000Z", endUtc: "2026-10-20T17:00:00.000Z", status: "OPEN", availableMentors: 4 });
  });

  it("defaults to 14 days from today and reports the 1 Nov clock change", async () => {
    const res = await request(app).get("/api/slots").query({ tz: "US/Eastern" });
    expect(res.body.timezone).toBe("America/New_York");
    expect(res.body.days).toHaveLength(14);
    expect(res.body.transitions).toEqual([{ date: "2026-11-01", atUtc: expect.any(String), fromOffset: -240, toOffset: -300, back: true }]);
  });

  it("rejects an unknown time zone", async () => {
    const res = await request(app).get("/api/slots").query({ tz: "Mars/Base" });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION");
    expect(res.body.error.details.fieldErrors.tz).toBe("Please choose your time zone");
  });
});

describe("GET /api/slots/suggestions", () => {
  const { app, db } = makeTestApp({ now: "2026-10-20T14:00:00Z" });
  beforeAll(async () => { await resetDb(); await seedMentors(db, { allWeek: true }); });
  afterAll(() => db.$disconnect());

  it("suggests same-day times around the requested time", async () => {
    const res = await request(app).get("/api/slots/suggestions").query({ tz: "America/New_York", date: "2026-10-21", time: "14:00" });
    expect(res.status).toBe(200);
    expect(res.body.strategy).toBe("SAME_DAY");
    expect(res.body.requested).toEqual({ date: "2026-10-21", time: "14:00", timezone: "America/New_York" });
    expect(res.body.suggestions).toHaveLength(4);
  });

  it("validates the time format", async () => {
    const res = await request(app).get("/api/slots/suggestions").query({ tz: "America/New_York", date: "2026-10-21", time: "14:15" });
    expect(res.status).toBe(422);
  });
});
