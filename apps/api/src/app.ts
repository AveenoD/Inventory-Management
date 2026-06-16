import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import { logger } from "./lib/logger.js";
import { authRouter } from "./routes/auth.routes.js";
import { monthsRouter } from "./routes/months.routes.js";
import { dailyRouter } from "./routes/daily.routes.js";
import { inventoryRouter } from "./routes/inventory.routes.js";
import { entriesRouter, partiesRouter } from "./routes/entries.routes.js";
import { todayRouter } from "./routes/today.routes.js";
import { notificationsRouter } from "./routes/notifications.routes.js";
import { importRouter } from "./routes/import.routes.js";
import { exportRouter } from "./routes/export.routes.js";
import { errorHandler } from "./middleware/error-handler.js";
import { requestTimeout } from "./middleware/request-timeout.js";
import { prisma } from "./lib/prisma.js";

const PRODUCTION_WEB_ORIGINS = [
  "https://sk-inventory.netlify.app",
  "http://localhost:3000",
];

function getAllowedOrigins(): string[] {
  const fromEnv = process.env.CORS_ORIGIN?.split(",").map((o) => o.trim()).filter(Boolean);
  return [...new Set([...PRODUCTION_WEB_ORIGINS, ...(fromEnv ?? [])])];
}

export function createApp() {
  const app = express();
  const allowedOrigins = getAllowedOrigins();

  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(null, false);
        }
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore: (req) => req.url === "/health",
      },
      customSuccessMessage(req, res, responseTime) {
        return `${req.method} ${req.url} → ${res.statusCode} (${Math.round(responseTime)}ms)`;
      },
      customErrorMessage(req, res, err) {
        return `${req.method} ${req.url} → ${res.statusCode} ERROR: ${err.message}`;
      },
      serializers: {
        req: () => undefined,
        res: () => undefined,
      },
    }),
  );
  app.use(requestTimeout());

  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests — please slow down" },
  });
  app.use("/api/v1", apiLimiter);

  app.get("/health", async (_req, res) => {
    const dbCheck = prisma.$queryRaw`SELECT 1`;
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("db_timeout")), 4_000),
    );
    try {
      await Promise.race([dbCheck, timeout]);
      res.json({ status: "ok", db: "connected" });
    } catch {
      res.status(503).json({ status: "degraded", db: "disconnected" });
    }
  });

  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/today", todayRouter);
  app.use("/api/v1/notifications", notificationsRouter);
  app.use("/api/v1/inventory", inventoryRouter);
  app.use("/api/v1/parties", partiesRouter);
  app.use("/api/v1/import", importRouter);
  app.use("/api/v1/export", exportRouter);
  app.use("/api/v1/months", monthsRouter);
  app.use("/api/v1/months/:id", dailyRouter);
  app.use("/api/v1/months/:id", entriesRouter);

  app.use(errorHandler);

  return app;
}
