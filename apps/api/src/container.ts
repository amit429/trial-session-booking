import type { Clock } from "./clock";
import type { Config } from "./config";
import type { Db } from "./db";
import { logger, type Logger } from "./logger";

export type Deps = { db: Db; clock: Clock; config: Config; logger: Logger };

/** Single composition root: wires services by hand so tests can swap the clock and database. */
export function buildContainer(input: { db: Db; clock: Clock; config: Config; logger?: Logger }) {
  const deps: Deps = { ...input, logger: input.logger ?? logger };
  return { ...deps };
}
export type Container = ReturnType<typeof buildContainer>;
