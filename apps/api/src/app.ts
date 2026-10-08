import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Router } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import type { Container } from "@/container";
import { errorHandler, notFoundHandler } from "@/http/errors";
import { originCheck } from "@/http/middleware/origin-check";
import { loadSession } from "@/http/middleware/session";
import { adminRoutes } from "@/modules/admin";
import { authRoutes } from "@/modules/auth";
import { bookingRoutes } from "@/modules/bookings";
import { devRoutes } from "@/modules/dev";
import { healthRoutes } from "@/modules/health";
import { meRoutes } from "@/modules/me";
import { slotRoutes } from "@/modules/slots";

/** Express app: security and parsing middleware, sessions, then one router per feature module under /api. */
export function createApp(c: Container, extra?: Router) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(cors({ origin: c.config.appBaseUrl, credentials: true }));
  app.use(express.json({ limit: "10kb" }));
  app.use(cookieParser());
  if (c.config.env !== "test") app.use(pinoHttp({ logger: c.logger }));

  const api = express.Router();
  api.use(originCheck(c.config.appBaseUrl));
  api.use(loadSession(c));
  for (const routes of [healthRoutes, slotRoutes, bookingRoutes, authRoutes, meRoutes, adminRoutes, devRoutes]) api.use(routes(c));
  if (extra) api.use(extra);
  api.use(notFoundHandler);

  app.use("/api", api);
  app.use(errorHandler(err => c.logger.error({ err }, "unhandled error")));
  return app;
}
