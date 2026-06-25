import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../middleware/auth.js";
import { importExcelWorkbook } from "../services/import-excel.service.js";
import { buildImportTemplateBuffer } from "../services/export.service.js";
import { generateTemplate, previewUniversalImport, executeUniversalImport, ImportEntity } from "../services/bulk-import.service.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export const importRouter = Router();
importRouter.use(requireAuth);

importRouter.get("/template", (_req, res) => {
  const buffer = buildImportTemplateBuffer();
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="sk-mobile-import-template.xlsx"');
  res.send(buffer);
});

importRouter.post("/excel", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const year = parseInt(String(req.body.year ?? new Date().getFullYear()), 10);
    const month = parseInt(String(req.body.month ?? new Date().getMonth() + 1), 10);
    const dryRun =
      req.query.dryRun === "true" ||
      req.query.dryRun === "1" ||
      req.body.dryRun === "true" ||
      req.body.dryRun === true;

    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
      res.status(400).json({ error: "Invalid year or month" });
      return;
    }

    const result = await importExcelWorkbook(
      req.file.buffer,
      req.user!.userId,
      year,
      month,
      dryRun,
    );

    if (result.errors.length > 0) {
      res.status(400).json(result);
      return;
    }

    res.json(result);
  } catch (e) {
    next(e);
  }
});

importRouter.get("/universal/template", (req, res) => {
  const entity = req.query.entity as string;
  if (!entity) {
    res.status(400).json({ error: "Entity is required" });
    return;
  }
  const buffer = generateTemplate(entity as ImportEntity);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="sk-mobile-import-template-${entity}.xlsx"`);
  res.send(buffer);
});

importRouter.post("/universal/preview", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }
    const entity = req.body.entity as string;
    if (!entity) {
      res.status(400).json({ error: "Entity is required" });
      return;
    }
    const result = await previewUniversalImport(req.file.buffer, entity as ImportEntity);
    res.json(result);
  } catch (e) {
    next(e);
  }
});

importRouter.post("/universal/execute", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }
    const entity = req.body.entity as string;
    if (!entity) {
      res.status(400).json({ error: "Entity is required" });
      return;
    }
    const result = await executeUniversalImport(req.user!.userId, req.file.buffer, entity as ImportEntity);
    res.json(result);
  } catch (e) {
    next(e);
  }
});
