import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { makeTestApp } from "../helpers/app";
import { resetDb } from "../helpers/db";
import { seedMentors } from "../helpers/factories";

const { app, db, config, container } = makeTestApp({ now: "2026-10-20T14:00:00Z" });
afterAll(() => db.$disconnect());

async function adminAgent() {
  await container.adminAuth.ensureAdmin();
  const agent = request.agent(app);
  await agent.post("/api/auth/admin/login").send({ email: config.admin.email, password: config.admin.password });
  return agent;
}
const book = (email: string, startUtc: string, tz = "America/New_York") =>
  request(app).post("/api/bookings").set("Idempotency-Key", randomUUID()).send({
    parent: { name: `Parent ${email.split("@")[0]}`, email }, child: { name: "Kid", grade: 3 }, subject: "MATH", startUtc, timezone: tz
  });

describe("admin console API", () => {
  beforeEach(async () => { await resetDb(); await seedMentors(db); });

  it("dashboard capacity per IST date counts only mentors working that weekday", async () => {
    await book("a@example.com", "2026-10-21T13:00:00.000Z", "Europe/London");
    const res = await (await adminAgent()).get("/api/admin/dashboard").query({ days: 3 });
    expect(res.status).toBe(200);
    // Tue 20, Wed 21, Thu 22 Oct (IST): one mentor off each day except none off... from seed: off Tue: Vikram; Wed: Priya; Thu: Sneha
    expect(res.body.capacity).toEqual([
      { istDate: "2026-10-20", booked: 0, capacity: 18 },
      { istDate: "2026-10-21", booked: 1, capacity: 18 },
      { istDate: "2026-10-22", booked: 0, capacity: 18 }
    ]);
    expect(res.body.next7DaysCount).toBe(1);
  });

  it("lists, filters and searches bookings; cancels on a parent's behalf", async () => {
    const one = await book("one@example.com", "2026-10-21T13:00:00.000Z", "Europe/London");
    await book("two@example.com", "2026-10-22T13:00:00.000Z", "Europe/London");
    const agent = await adminAgent();
    const all = await agent.get("/api/admin/bookings");
    expect(all.body.total).toBe(2);
    expect(all.body.items[0]).toMatchObject({ reference: one.body.reference, parentStatus: "GUEST", mentorLocalDate: "2026-10-21" });
    expect((await agent.get("/api/admin/bookings").query({ q: "two@" })).body.total).toBe(1);
    const cancel = await agent.post(`/api/admin/bookings/${one.body.reference}/cancel`).set("Origin", config.appBaseUrl);
    expect(cancel.status).toBe(200);
    expect(cancel.body).toMatchObject({ status: "CANCELLED", cancelledBy: "ADMIN" });
    expect((await agent.get("/api/admin/bookings").query({ status: "CANCELLED" })).body.total).toBe(1);
    const msg = await db.outboxMessage.findFirst({ where: { kind: "BOOKING_CANCELLED_PARENT" } });
    expect(msg!.body).toContain("cancelled by our team");
    const detail = await agent.get(`/api/admin/bookings/${one.body.reference}`);
    expect(detail.body.messages.length).toBe(4);
  });

  it("shows parents with account status and booking counts", async () => {
    await book("guest@example.com", "2026-10-21T13:00:00.000Z", "Europe/London");
    const agent = await adminAgent();
    const res = await agent.get("/api/admin/parents");
    expect(res.body.items).toEqual([expect.objectContaining({ email: "guest@example.com", status: "GUEST", bookingCount: 1, upcomingCount: 1 })]);
    const detail = await agent.get(`/api/admin/parents/${res.body.items[0].id}`);
    expect(detail.body.bookings).toHaveLength(1);
  });

  it("shows each mentor's weekly shift and per-day load", async () => {
    const b = await book("x@example.com", "2026-10-21T13:00:00.000Z", "Europe/London");
    const agent = await adminAgent();
    const mentors = (await agent.get("/api/admin/mentors")).body;
    expect(mentors).toHaveLength(10);
    const m = mentors.find((x: { name: string }) => x.name === b.body.mentor.name);
    expect(m.weeklyShift.length).toBe(6);
    const sched = await agent.get(`/api/admin/mentors/${m.id}/schedule`).query({ from: "2026-10-21", days: 2 });
    expect(sched.body.days[0]).toMatchObject({ istDate: "2026-10-21", booked: 1, max: 2 });
    expect(sched.body.days[0].bookings[0].reference).toBe(b.body.reference);
  });

  it("serves the dev outbox only when enabled", async () => {
    await book("x@example.com", "2026-10-21T13:00:00.000Z", "Europe/London");
    expect((await request(app).get("/api/dev/outbox")).status).toBe(404);
    const dev = makeTestApp({ env: { DEV_OUTBOX_ENABLED: "true" } });
    const res = await request(dev.app).get("/api/dev/outbox");
    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({ kind: expect.stringMatching(/^BOOKING_CONFIRMED/), bookingReference: expect.stringMatching(/^CY-/) });
  });
});
