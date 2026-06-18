import { Router } from "express";
import {
  addPurchasePaymentSchema,
  createPurchaseSchema,
  paginationQuerySchema,
} from "@sk-mobile/shared";
import { requireAuth } from "../middleware/auth.js";
import {
  addPurchasePayment,
  createPurchase,
  getPurchaseById,
  listPurchases,
} from "../services/purchase.service.js";

export const purchaseRouter = Router();
purchaseRouter.use(requireAuth);

purchaseRouter.get("/", async (req, res, next) => {
  try {
    const q = paginationQuerySchema.parse(req.query);
    const date = typeof req.query.date === "string" ? req.query.date : undefined;
    const partyId = typeof req.query.partyId === "string" ? req.query.partyId : undefined;
    const result = await listPurchases(req.user!.userId, {
      page: q.page,
      limit: q.limit,
      date,
      partyId,
    });
    res.json(result);
  } catch (e) {
    next(e);
  }
});

purchaseRouter.get("/:id", async (req, res, next) => {
  try {
    const purchase = await getPurchaseById(req.user!.userId, req.params.id);
    if (!purchase) {
      res.status(404).json({ error: "Purchase not found" });
      return;
    }
    res.json(purchase);
  } catch (e) {
    next(e);
  }
});

purchaseRouter.post("/", async (req, res, next) => {
  try {
    const body = createPurchaseSchema.parse(req.body);
    const purchase = await createPurchase(req.user!.userId, body);
    res.status(201).json(purchase);
  } catch (e) {
    next(e);
  }
});

purchaseRouter.post("/:id/payments", async (req, res, next) => {
  try {
    const body = addPurchasePaymentSchema.parse(req.body);
    const purchase = await addPurchasePayment(req.user!.userId, req.params.id, body);
    res.json(purchase);
  } catch (e) {
    next(e);
  }
});
