import { describe, expect, it } from "vitest";
import { CreateBookingRequest, ERROR_MESSAGES, ResetPasswordRequest, SignupRequest } from "../src";

const valid = {
  parent: { name: "Jane Doe", email: " Jane@Example.com ", phone: "+1 555 010 2000" },
  child: { name: "Sam", grade: 4 },
  subject: "CODING",
  startUtc: "2026-10-20T19:00:00.000Z",
  timezone: "America/New_York"
};

describe("CreateBookingRequest", () => {
  it("trims and lowercases the email", () => {
    expect(CreateBookingRequest.parse(valid).parent.email).toBe("jane@example.com");
  });
  it("rejects grade 0 with a friendly message", () => {
    const r = CreateBookingRequest.safeParse({ ...valid, child: { name: "Sam", grade: 0 } });
    expect(r.success).toBe(false);
    expect(r.error!.issues[0].message).toBe("Choose a grade between 1 and 12");
  });
  it("rejects times off the 30-minute grid", () => {
    const r = CreateBookingRequest.safeParse({ ...valid, startUtc: "2026-10-20T19:15:00.000Z" });
    expect(r.error!.issues[0].message).toBe("Please pick a time from the list");
  });
  it("rejects unknown time zones and normalises aliases", () => {
    expect(CreateBookingRequest.safeParse({ ...valid, timezone: "Mars/Base" }).success).toBe(false);
    expect(CreateBookingRequest.parse({ ...valid, timezone: "Asia/Calcutta" }).timezone).toBe("Asia/Kolkata");
  });
  it("treats an empty phone as absent", () => {
    expect(CreateBookingRequest.parse({ ...valid, parent: { ...valid.parent, phone: "" } }).parent.phone).toBeUndefined();
  });
});

describe("password rules", () => {
  it("rejects a password equal to the email", () => {
    const r = SignupRequest.safeParse({ name: "Jane", email: "jane@example.com", password: "jane@example.com" });
    expect(r.error!.issues[0].message).toBe("Password can't be your email");
  });
  it("requires 8 characters on reset", () => {
    expect(ResetPasswordRequest.safeParse({ token: "t", password: "short" }).success).toBe(false);
  });
});

it("every error code has a user-facing message", () => {
  expect(ERROR_MESSAGES.SLOT_UNAVAILABLE).toBe("That time was just booked.");
  expect(Object.keys(ERROR_MESSAGES)).toHaveLength(15);
});
