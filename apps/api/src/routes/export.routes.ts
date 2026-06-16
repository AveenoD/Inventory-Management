import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  buildDayExportBuffer,
  buildImportTemplateBuffer,
  buildMonthExportBuffer,
} from "../services/export.service.js";

export const exportRouter = Router();
exportRouter.use(requireAuth);

exportRouter.get("/excel", async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const dateStr = typeof req.query.date === "string" ? req.query.date : null;

    if (dateStr) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        res.status(400).json({ error: "Invalid date — use YYYY-MM-DD" });
        return;
      }
      const { buffer, filename } = await buildDayExportBuffer(userId, dateStr);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(buffer);
      return;
    }

    const year = parseInt(String(req.query.year ?? ""), 10);
    const month = parseInt(String(req.query.month ?? ""), 10);
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
      res.status(400).json({ error: "Provide year and month (1–12), or a date for single-day export" });
      return;
    }

    const { buffer, filename } = await buildMonthExportBuffer(userId, year, month);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (e) {
    if (e instanceof Error && e.message.includes("No data found")) {
      res.status(404).json({ error: e.message });
      return;
    }
    next(e);
  }
});

exportRouter.get("/template", (_req, res) => {
  const buffer = buildImportTemplateBuffer();
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="sk-mobile-import-template.xlsx"');
  res.send(buffer);
});
