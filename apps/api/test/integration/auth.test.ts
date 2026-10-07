import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { makeTestApp } from "../helpers/app";
import { resetDb } from "../helpers/db";
import { seedMentors } from "../helpers/factories";

const { app, db, config, container } = makeTestApp({ now: "2026-10-20T14:00:00Z" });
const ORIGIN = config.appBaseUrl;
afterAll(() => db.$disconnect());

async function lastLink(email: string, path: string) {
  const msg = await db.outboxMessage.findFirst({ where: { toEmail: email, body: { contains: path } }, orderBy: { createdAt: "desc" } });
  return msg!.body.match(new RegExp(`${path}\\?token=([\\w-]+)`))![1];
}
async function verifiedParent(email = "jane@example.com", password = "CorrectHorse1") {
  await request(app).post("/api/auth/parent/signup").send({ name: "Jane Doe", email, password });
  await request(app).post("/api/auth/parent/verify").send({ token: await lastLink(email, "/verify-email") });
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/parent/login").set("Origin", ORIGIN).send({ email, password });
  expect(res.status).toBe(200);
  return agent;
}
function book(email: string, startUtc = "2026-10-21T19:00:00.000Z") {
  return request(app).post("/api/bookings").set("Idempotency-Key", randomUUID()).send({
    parent: { name: "Jane Doe", email }, child: { name: "Sam", grade: 4 }, subject: "CODING", startUtc, timezone: "America/New_York"
  });
}

describe("parent accounts", () => {
  beforeEach(async () => { await resetDb(); await seedMentors(db, { allWeek: true }); });

  it("sign-up answers the same for new and existing emails, and warns the real owner", async () => {
    const first = await request(app).post("/api/auth/parent/signup").send({ name: "Jane Doe", email: "jane@example.com", password: "CorrectHorse1" });
    await request(app).post("/api/auth/parent/verify").send({ token: await lastLink("jane@example.com", "/verify-email") });
    const second = await request(app).post("/api/auth/parent/signup").send({ name: "Mallory", email: "jane@example.com", password: "Whatever123" });
    expect(first.status).toBe(202);
    expect(second.status).toBe(202);
    expect(second.body).toEqual(first.body);
    expect(await db.outboxMessage.count({ where: { kind: "ACCOUNT_EXISTS" } })).toBe(1);
  });

  it("pending accounts can't sign in until verified; then a session cookie is set", async () => {
    await request(app).post("/api/auth/parent/signup").send({ name: "Jane Doe", email: "jane@example.com", password: "CorrectHorse1" });
    const pending = await request(app).post("/api/auth/parent/login").send({ email: "jane@example.com", password: "CorrectHorse1" });
    expect(pending.status).toBe(403);
    expect(pending.body.error.code).toBe("EMAIL_NOT_VERIFIED");
    await request(app).post("/api/auth/parent/verify").send({ token: await lastLink("jane@example.com", "/verify-email") });
    const ok = await request(app).post("/api/auth/parent/login").send({ email: "jane@example.com", password: "CorrectHorse1" });
    expect(ok.status).toBe(200);
    expect(ok.body.parent).toMatchObject({ email: "jane@example.com", status: "VERIFIED" });
    const cookie = ok.headers["set-cookie"][0];
    expect(cookie).toMatch(/^cy_parent_sid=/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
  });

  it("wrong password and unknown email look identical", async () => {
    await verifiedParent();
    const a = await request(app).post("/api/auth/parent/login").send({ email: "jane@example.com", password: "nope-nope" });
    const b = await request(app).post("/api/auth/parent/login").send({ email: "ghost@example.com", password: "nope-nope" });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body).toEqual(b.body);
    expect(a.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("verification links work once", async () => {
    await request(app).post("/api/auth/parent/signup").send({ name: "Jane Doe", email: "jane@example.com", password: "CorrectHorse1" });
    const token = await lastLink("jane@example.com", "/verify-email");
    expect((await request(app).post("/api/auth/parent/verify").send({ token })).status).toBe(200);
    const again = await request(app).post("/api/auth/parent/verify").send({ token });
    expect(again.status).toBe(400);
    expect(again.body.error.code).toBe("TOKEN_INVALID");
  });

  it("password reset verifies the email and ends every session", async () => {
    const agent = await verifiedParent();
    expect((await agent.get("/api/auth/me")).body.parent).not.toBeNull();
    expect((await request(app).post("/api/auth/parent/forgot-password").send({ email: "jane@example.com" })).status).toBe(202);
    expect((await request(app).post("/api/auth/parent/forgot-password").send({ email: "nobody@example.com" })).status).toBe(202);
    const token = await lastLink("jane@example.com", "/reset-password");
    expect((await request(app).post("/api/auth/parent/reset-password").send({ token, password: "NewPassword9" })).status).toBe(200);
    expect((await agent.get("/api/auth/me")).body.parent).toBeNull();
    expect((await request(app).post("/api/auth/parent/login").send({ email: "jane@example.com", password: "NewPassword9" })).status).toBe(200);
  });

  it("a guest booking shows up in My bookings after the parent signs up and verifies", async () => {
    expect((await book("jane@example.com")).status).toBe(201);
    const agent = await verifiedParent();
    const res = await agent.get("/api/me/bookings").query({ scope: "upcoming" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].child.name).toBe("Sam");
  });

  it("a signed-in parent can't open another family's booking (404, not 403)", async () => {
    const other = await book("other@example.com");
    const agent = await verifiedParent();
    const res = await agent.get(`/api/bookings/${other.body.reference}`);
    expect(res.status).toBe(404);
  });

  it("logout ends the session", async () => {
    const agent = await verifiedParent();
    expect((await agent.post("/api/auth/parent/logout").set("Origin", ORIGIN)).status).toBe(204);
    expect((await agent.get("/api/me/bookings")).status).toBe(401);
  });
});

describe("admin and cross-cutting protection", () => {
  beforeEach(async () => { await resetDb(); await container.adminAuth.ensureAdmin(); });

  it("a parent cookie never unlocks admin endpoints", async () => {
    const agent = await verifiedParent();
    expect((await agent.get("/api/admin/dashboard")).status).toBe(401);
  });

  it("admin signs in with the seeded account", async () => {
    const agent = request.agent(app);
    const res = await agent.post("/api/auth/admin/login").send({ email: config.admin.email, password: config.admin.password });
    expect(res.status).toBe(200);
    expect(res.headers["set-cookie"][0]).toMatch(/^cy_admin_sid=/);
    expect((await agent.get("/api/auth/me")).body.admin).toMatchObject({ email: config.admin.email });
    expect((await request(app).post("/api/auth/admin/login").send({ email: config.admin.email, password: "wrong-pass" })).status).toBe(401);
  });

  it("blocks state-changing requests with a session cookie from another origin", async () => {
    const agent = await verifiedParent();
    const res = await agent.post("/api/auth/parent/logout").set("Origin", "https://evil.example");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ORIGIN_MISMATCH");
  });
});

describe("rate limiting", () => {
  const limited = makeTestApp({ env: { RATE_LIMIT_ENABLED: "true" } });
  it("locks sign-in after 5 attempts a minute for the same email", async () => {
    const codes = [];
    for (let i = 0; i < 6; i++) codes.push((await request(limited.app).post("/api/auth/parent/login").send({ email: "x@example.com", password: "bad-pass1" })).status);
    expect(codes).toEqual([401, 401, 401, 401, 401, 429]);
  });
});
