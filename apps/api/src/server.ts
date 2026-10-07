import { createApp } from "./app";
import { SystemClock } from "./clock";
import { loadConfig } from "./config";
import { buildContainer } from "./container";
import { createDb } from "./db";
import { logger } from "./logger";

const config = loadConfig();
const db = createDb();
const container = buildContainer({ db, clock: new SystemClock(), config, logger });
const app = createApp(container);

app.listen(config.port, () => logger.info(`API listening on http://localhost:${config.port}`));
