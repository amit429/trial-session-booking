import { createApp } from "@/app";
import { SystemClock } from "@/core/clock";
import { loadConfig } from "@/core/config";
import { buildContainer } from "@/container";
import { createDb } from "@/core/db";
import { logger } from "@/core/logger";

const config = loadConfig();
const db = createDb();
const container = buildContainer({ db, clock: new SystemClock(), config, logger });
const app = createApp(container);

app.listen(config.port, () => logger.info(`API listening on http://localhost:${config.port}`));
