import { createApp } from "@/app";
import { buildContainer } from "@/container";
import { SystemClock } from "@/core/clock";
import { loadConfig } from "@/core/config";
import { createDb } from "@/core/db";
import { logger } from "@/core/logger";

/** Process entry point: wire dependencies, start listening, and shut down cleanly on SIGINT/SIGTERM. */
async function main() {
  const config = loadConfig();
  const db = createDb();
  const container = buildContainer({ db, clock: new SystemClock(), config, logger });
  await container.sessions.purgeExpired();

  const server = createApp(container).listen(config.port, () => logger.info(`API listening on http://localhost:${config.port}`));

  const shutdown = (signal: string) => {
    logger.info(`${signal} received, shutting down`);
    server.close(async () => {
      await db.$disconnect();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch(err => {
  logger.fatal({ err }, "failed to start");
  process.exit(1);
});
