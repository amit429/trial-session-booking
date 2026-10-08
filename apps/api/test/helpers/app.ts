import { FixedClock } from "@/core/clock";
import { loadConfig } from "@/core/config";
import { buildContainer, type Container } from "@/container";
import { createApp } from "@/app";
import { testDb } from "./db";

export function makeTestApp(opts: { now?: string; env?: Record<string, string> } = {}) {
  const clock = new FixedClock(new Date(opts.now ?? "2026-10-20T14:00:00Z"));
  const config = loadConfig({ ...process.env, RATE_LIMIT_ENABLED: "false", DEV_OUTBOX_ENABLED: "false", ...opts.env });
  const container: Container = buildContainer({ db: testDb, clock, config });
  const app = createApp(container);
  return { app, clock, config, container, db: testDb };
}
