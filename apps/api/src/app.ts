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
  credentials: true,
  origin(origin, callback) {
    const allowedOrigins = resolveCorsOrigin();

    if (allowedOrigins === true) {
      callback(null, origin);
      return;
    }

    if (
      Array.isArray(allowedOrigins) &&
      origin !== undefined &&
      allowedOrigins.includes(origin)
    ) {
      callback(null, origin);
      return;
    }

    if (!origin) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS blocked for origin: ${origin}`));
  },
};

export function createApp() {
  const app = express();

  app.use(
    helmet({
      crossOriginResourcePolicy: false,
    }),
  );

  app.use(cors(corsOptions));

  app.use(rateLimitContextMiddleware);
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ success: true, data: { ok: true, service: "captain-api", env: env.NODE_ENV } });
  });

  app.get("/", (_req, res) => {
    res.json({ success: true, data: { ok: true, service: "captain-api", env: env.NODE_ENV } });
  });

  app.use("/api/v1", v1Router);

  app.use(errorHandlerMiddleware);
  return app;
}
