import { describe, expect, it } from "vitest";
import { hashToken, manageToken, newToken, verifyManageToken } from "../../src/domain/tokens";
import { newReference } from "../../src/domain/reference";

describe("tokens", () => {
  it("creates unguessable url-safe tokens and stores only hashes", () => {
    const t = newToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hashToken(t)).toMatch(/^[a-f0-9]{64}$/);
    expect(newToken()).not.toBe(t);
  });
  it("manage tokens verify only for the right booking and secret", () => {
    const t = manageToken("s".repeat(32), "booking-1");
    expect(verifyManageToken("s".repeat(32), "booking-1", t)).toBe(true);
    expect(verifyManageToken("s".repeat(32), "booking-2", t)).toBe(false);
    expect(verifyManageToken("x".repeat(32), "booking-1", t)).toBe(false);
    expect(verifyManageToken("s".repeat(32), "booking-1", "short")).toBe(false);
  });
  it("references avoid ambiguous characters", () => {
    for (let i = 0; i < 200; i++) expect(newReference()).toMatch(/^CY-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  });
});
