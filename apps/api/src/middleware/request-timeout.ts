import type { Request, Response, NextFunction } from "express";

const DEFAULT_MS = 15_000;

export function requestTimeout(ms = DEFAULT_MS) {
  return (req: Request, res: Response, next: NextFunction) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(504).json({
          error: "Server timeout — database may be slow or unreachable",
        });
      }
    }, ms);
    res.on("finish", () => clearTimeout(timer));
    res.on("close", () => clearTimeout(timer));
    next();
  };
}
