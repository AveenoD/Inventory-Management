import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { loginSchema } from "@sk-mobile/shared";
import { prisma } from "../lib/prisma.js";

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many login attempts" },
});

export const authRouter = Router();

authRouter.post("/login", loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET missing");
    const expiresIn = process.env.JWT_EXPIRES_IN ?? "24h";
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      secret,
      { expiresIn } as jwt.SignOptions,
    );
    res.json({
      token,
      user: { id: user.id, email: user.email },
    });
  } catch (e) {
    next(e);
  }
});

authRouter.get("/me", async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const secret = process.env.JWT_SECRET!;
    const payload = jwt.verify(header.slice(7), secret) as {
      userId: string;
      email: string;
    };
    res.json({ user: payload });
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});
