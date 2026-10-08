import { hash, verify } from "@node-rs/argon2";

// argon2id with the library's defaults (meets OWASP minimums).
export const hashPassword = (password: string) => hash(password);

let dummy: Promise<string> | undefined;
/** Verify, spending the same time when there's no account, so responses don't reveal which emails exist. */
export async function verifyPassword(storedHash: string | null | undefined, password: string): Promise<boolean> {
  if (!storedHash) {
    dummy ??= hash("not-a-real-password");
    await verify(await dummy, password).catch(() => false);
    return false;
  }
  return verify(storedHash, password).catch(() => false);
}
