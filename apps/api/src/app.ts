import express from "express";
import cors from "cors";
import type { CorsOptions } from "cors";
import helmet from "helmet";
import { isPrivateLanDevOrigin, resolveCorsOrigin } from "./config/cors-options.js";
import { env } from "./config/env.js";
import { OFFER_CONFIRMATION_WINDOW_SECONDS } from "./services/distribution/constants.js";
import { rateLimitContextMiddleware } from "./middlewares/rate-limit-context.middleware.js";
import { errorHandlerMiddleware } from "./middlewares/error-handler.middleware.js";
import { v1Router } from "./routes/v1/index.js";

const corsOptions: CorsOptions = {
  credentials: true,
  origin(origin, callback) {
    const allowedOrigins = resolveCorsOrigin();

    if (allowedOrigins === true) {
      callback(null, true);
      return;
    }

    if (allowedOrigins === false) {
      callback(new Error("CORS is disabled"));
      return;
    }

    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    if (origin && isPrivateLanDevOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(
      new Error(
        `CORS blocked for origin: ${origin}. Allowed origins: ${allowedOrigins.join(", ")}`
      )
    );
  },
};

const app = express();

app.set("trust proxy", 1);

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(rateLimitContextMiddleware);

app.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    service: "captain-api",
    environment: env.NODE_ENV,
    /** Fixed product offer window (seconds) — same value used for `expiredAt` on insert. */
    offerConfirmationWindowSeconds: OFFER_CONFIRMATION_WINDOW_SECONDS,
    /** Same as offerConfirmationWindowSeconds (legacy health field name). */
    distributionTimeoutSeconds: OFFER_CONFIRMATION_WINDOW_SECONDS,
  });
});

app.use("/api/v1", v1Router);

app.use(errorHandlerMiddleware);

export { app };
