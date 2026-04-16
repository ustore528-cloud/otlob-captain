import express from "express";
import cors from "cors";
import helmet from "helmet";
import { resolveCorsOrigin } from "./config/cors-options.js";
import { env } from "./config/env.js";
import { rateLimitContextMiddleware } from "./middlewares/rate-limit-context.middleware.js";
import { errorHandlerMiddleware } from "./middlewares/error-handler.middleware.js";
import { v1Router } from "./routes/v1/index.js";

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(
    cors({
      origin: resolveCorsOrigin(),
      credentials: true,
    }),
  );

  // نقطة الدخول المركزية لأي Rate Limiter خارجي (Redis مثلًا)
  app.use(rateLimitContextMiddleware);
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ success: true, data: { ok: true, service: "captain-api", env: env.NODE_ENV } });
  });

  app.use("/api/v1", v1Router);

  app.use(errorHandlerMiddleware);
  return app;
}
