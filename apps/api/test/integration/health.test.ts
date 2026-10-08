import express from "express";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { AppError } from "@/http/errors";
import { makeTestApp } from "../helpers/app";

describe("API skeleton", () => {
  const { app, db } = makeTestApp();
  afterAll(() => db.$disconnect());

  it("reports health with a database ping", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", db: "ok" });
  });

  it("returns the error envelope for unknown routes", async () => {
    const res = await request(app).get("/api/nope");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("maps unexpected errors to INTERNAL without leaking stacks, and AppErrors to their status", async () => {
    const { container } = makeTestApp();
    const { createApp } = await import("@/app");
    const extra = express.Router();
    extra.get("/boom", () => {
      throw new Error("secret stack detail");
    });
    extra.get("/gone", () => {
      throw new AppError("ALREADY_STARTED", 422);
    });
    const a = createApp(container, extra);
    const boom = await request(a).get("/api/boom");
    expect(boom.status).toBe(500);
    expect(boom.body).toEqual({ error: { code: "INTERNAL", message: "Something went wrong. Please try again." } });
    const gone = await request(a).get("/api/gone");
    expect(gone.status).toBe(422);
    expect(gone.body.error.code).toBe("ALREADY_STARTED");
  });
});
