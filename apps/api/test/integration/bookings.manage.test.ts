import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { makeTestApp } from "../helpers/app";
import { resetDb } from "../helpers/db";
import { seedMentors } from "../helpers/factories";

const { app, db, clock } = makeTestApp({ now: "2026-10-20T14:00:00Z" });
afterAll(() => db.$disconnect());

async function book() {
  const res = await request(app).post("/api/bookings").set("Idempotency-Key", randomUUID()).send({
    parent: { name: "Jane Doe", email: "jane@example.com" }, child: { name: "Sam", grade: 4 }, subject: "MATH",
    startUtc: "2026-10-21T19:00:00.000Z", timezone: "America/New_York"
  });
  const url = new URL(res.body.manageUrl);
  return { ref: res.body.reference as string, token: url.searchParams.get("token")! };
}

describe("manage a booking with its private link", () => {
  beforeEach(async () => { clock.set(new Date("2026-10-20T14:00:00Z")); await resetDb(); await seedMentors(db, { allWeek: true }); });

  it("shows the booking to the token holder only", async () => {
    const { ref, token } = await book();
    const ok = await request(app).get(`/api/bookings/${ref}`).query({ token });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ reference: ref, status: "CONFIRMED", subject: "MATH", parentAccount: "GUEST" });
    expect((await request(app).get(`/api/bookings/${ref}`).query({ token: "wrong" })).status).toBe(404);
    expect((await request(app).get(`/api/bookings/${ref}`)).status).toBe(404);
    expect((await request(app).get(`/api/bookings/CY-NOPE22`).query({ token })).status).toBe(404);
  });

  it("cancels, frees the slot, tells both sides, and is idempotent", async () => {
    const { ref, token } = await book();
    const res = await request(app).post(`/api/bookings/${ref}/cancel`).send({ token });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "CANCELLED", cancelledBy: "PARENT" });
    expect(await db.outboxMessage.count({ where: { kind: { in: ["BOOKING_CANCELLED_PARENT", "BOOKING_CANCELLED_MENTOR"] } } })).toBe(2);
    const again = await request(app).post(`/api/bookings/${ref}/cancel`).send({ token });
    expect(again.status).toBe(200);
    expect(await db.outboxMessage.count({ where: { kind: "BOOKING_CANCELLED_PARENT" } })).toBe(1);
    const slots = await request(app).get("/api/slots").query({ tz: "America/New_York", from: "2026-10-21", days: 1 });
    expect(slots.body.days[0].slots.find((s: { startUtc: string }) => s.startUtc === "2026-10-21T19:00:00.000Z").availableMentors).toBe(4);
  });

  it("two simultaneous cancels notify people only once", async () => {
    const { ref, token } = await book();
    const [a, b] = await Promise.all([
      request(app).post(`/api/bookings/${ref}/cancel`).send({ token }),
      request(app).post(`/api/bookings/${ref}/cancel`).send({ token })
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(await db.outboxMessage.count({ where: { kind: "BOOKING_CANCELLED_PARENT" } })).toBe(1);
  });

  it("refuses to cancel a class that has started", async () => {
    const { ref, token } = await book();
    clock.set(new Date("2026-10-21T19:05:00Z"));
    const res = await request(app).post(`/api/bookings/${ref}/cancel`).send({ token });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("ALREADY_STARTED");
  });

  it("serves an .ics calendar file in UTC", async () => {
    const { ref, token } = await book();
    const res = await request(app).get(`/api/bookings/${ref}/calendar.ics`).query({ token });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/calendar/);
    expect(res.text).toContain("DTSTART:20261021T190000Z");
    expect(res.text).toContain("DTEND:20261021T200000Z");
  });
});
