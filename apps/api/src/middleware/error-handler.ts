import type { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Duplicate entry" });
    }
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Not found" });
    }
  }
  if (err && typeof err === "object" && "issues" in err) {
    return res.status(400).json({ error: "Validation failed" });
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
}
