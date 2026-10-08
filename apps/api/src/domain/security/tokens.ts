import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** 32 random bytes, url-safe. Only its hash is ever stored. */
export const newToken = () => randomBytes(32).toString("base64url");
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Private manage link token: HMAC of the booking id, so nothing needs storing (ADR-11). */
export const manageToken = (secret: string, bookingId: string) =>
  createHmac("sha256", secret).update(`manage:${bookingId}`).digest("base64url");

export function verifyManageToken(secret: string, bookingId: string, token: string): boolean {
  const expected = Buffer.from(manageToken(secret, bookingId));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
