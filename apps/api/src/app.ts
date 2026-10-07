import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Router } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import type { Container } from "./container";
import { errorHandler, notFoundHandler } from "./http/errors";
import { healthRoutes } from "./routes/health";
import { originCheck } from "./http/originCheck";
import { loadSession } from "./http/session";
import { adminRoutes } from "./routes/admin";
import { authRoutes } from "./routes/auth";
import { bookingRoutes } from "./routes/bookings";
import { meRoutes } from "./routes/me";
import { slotRoutes } from "./routes/slots";

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
  api.use(healthRoutes(c));
  api.use(slotRoutes(c));
  api.use(bookingRoutes(c));
  api.use(authRoutes(c));
  api.use(meRoutes(c));
  api.use(adminRoutes(c));
  if (extra) api.use(extra);
  api.use(notFoundHandler);

  app.use("/api", api);
  app.use(errorHandler(err => c.logger.error({ err }, "unhandled error")));
  return app;
}
