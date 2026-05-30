import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { logger } from "./lib/logger.js";
import { authRouter } from "./routes/auth.routes.js";
import { monthsRouter } from "./routes/months.routes.js";
import { dailyRouter } from "./routes/daily.routes.js";
import { inventoryRouter } from "./routes/inventory.routes.js";
import { entriesRouter, partiesRouter } from "./routes/entries.routes.js";
import { todayRouter } from "./routes/today.routes.js";
import { importRouter } from "./routes/import.routes.js";
import { errorHandler } from "./middleware/error-handler.js";
import { requestTimeout } from "./middleware/request-timeout.js";
import { prisma } from "./lib/prisma.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN?.split(",") ?? "http://localhost:3000",
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
  app.use("/api/v1/inventory", inventoryRouter);
  app.use("/api/v1/parties", partiesRouter);
  app.use("/api/v1/import", importRouter);
  app.use("/api/v1/months", monthsRouter);
  app.use("/api/v1/months/:id", dailyRouter);
  app.use("/api/v1/months/:id", entriesRouter);

  app.use(errorHandler);

  return app;
}
