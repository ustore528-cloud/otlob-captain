import express from "express";
import cors from "cors";
import type { CorsOptions } from "cors";
import helmet from "helmet";
import { resolveCorsOrigin } from "./config/cors-options.js";
import { env } from "./config/env.js";
import { rateLimitContextMiddleware } from "./middlewares/rate-limit-context.middleware.js";
import { errorHandlerMiddleware } from "./middlewares/error-handler.middleware.js";
import { v1Router } from "./routes/v1/index.js";

const corsOptions: CorsOptions = {
  origin: resolveCorsOrigin(),
  credentials: true,
};

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors(corsOptions));
  app.options("*", cors(corsOptions));

  // نقطة الدخول المركزية لأي Rate Limiter خارجي (Redis مثلًا)
  app.use(rateLimitContextMiddleware);
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ success: true, data: { ok: true, service: "captain-api", env: env.NODE_ENV } });
  });

  /** الجذر للتحقق السريع من المتصفح — نفس بيانات `/health` */
  app.get("/", (_req, res) => {
    res.json({ success: true, data: { ok: true, service: "captain-api", env: env.NODE_ENV } });
  });

  app.use("/api/v1", v1Router);

  app.use(errorHandlerMiddleware);
  return app;
}
