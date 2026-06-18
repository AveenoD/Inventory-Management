import { Router } from "express";
import { updateInvoiceSettingsSchema } from "@sk-mobile/shared";
import { requireAuth } from "../middleware/auth.js";
import {
  getOrCreateInvoiceSettings,
  updateInvoiceSettings,
} from "../services/invoice.service.js";

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

settingsRouter.get("/invoice", async (req, res, next) => {
  try {
    const settings = await getOrCreateInvoiceSettings(req.user!.userId);
    res.json(settings);
  } catch (e) {
    next(e);
  }
});

settingsRouter.put("/invoice", async (req, res, next) => {
  try {
    const body = updateInvoiceSettingsSchema.parse(req.body);
    const settings = await updateInvoiceSettings(req.user!.userId, body);
    res.json(settings);
  } catch (e) {
    next(e);
  }
});
