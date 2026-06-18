import type { Request, Response, NextFunction } from "express";
import {
  PrismaClientInitializationError,
  PrismaClientKnownRequestError,
} from "@prisma/client/runtime/library";

function dbErrorMessage(err: unknown): string | null {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("Can't reach database server")) {
    return "Database is unreachable. Start local Postgres or check DATABASE_URL in apps/api/.env";
  }
  if (msg.includes("max clients reached") || msg.includes("EMAXCONNSESSION")) {
    return "Database connection pool full. Use local Postgres for dev, or retry in a moment.";
  }
  if (msg.includes("Connection refused") || msg.includes("ECONNREFUSED")) {
    return "Database connection refused. Is PostgreSQL running on localhost:5432?";
  }
  return null;
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof PrismaClientInitializationError) {
    return res.status(503).json({
      error: dbErrorMessage(err) ?? "Database connection failed",
    });
  }
  if (err instanceof PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Duplicate entry" });
    }
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Not found" });
    }
    if (err.code === "P2022") {
      return res.status(503).json({
        error: "Database schema is out of date. Run: cd apps/api && npx prisma migrate deploy",
      });
    }
  }
  if (err && typeof err === "object" && "issues" in err) {
    return res.status(400).json({ error: "Validation failed" });
  }
  const dbMsg = dbErrorMessage(err);
  if (dbMsg) {
    return res.status(503).json({ error: dbMsg });
  }
  if (err instanceof Error) {
    const msg = err.message?.trim();
    if (msg && !msg.includes("Invalid `") && !msg.includes("invocation in")) {
      return res.status(400).json({ error: msg });
    }
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
}
