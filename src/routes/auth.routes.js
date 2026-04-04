// ─────────────────────────────────────────────────────────
// src/routes/auth.routes.js — Authentication routes
// ─────────────────────────────────────────────────────────

import { Router } from "express";
import { login } from "../controllers/player.controller.js";
import { validateLogin } from "../middleware/validate.js";

const router = Router();
const ADMIN_SECRET = process.env.ADMIN_SECRET || "shams-admin-2026";

// POST /api/auth/login
router.post("/login", validateLogin, login);

// POST /api/auth/admin-login
router.post("/admin-login", (req, res) => {
  const { password } = req.body || {};

  if (password !== ADMIN_SECRET) {
    return res.status(401).json({
      ok: false,
      error: "ADMIN_AUTH_INVALID",
      message: "كلمة مرور المشرف غير صحيحة",
    });
  }

  return res.json({
    ok: true,
    token: ADMIN_SECRET,
  });
});

export default router;
