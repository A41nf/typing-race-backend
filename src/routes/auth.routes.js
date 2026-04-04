// ─────────────────────────────────────────────────────────
// src/routes/auth.routes.js — Authentication routes
// ─────────────────────────────────────────────────────────

import { Router } from "express";
import { login } from "../controllers/player.controller.js";
import { validateLogin } from "../middleware/validate.js";

const router = Router();

// POST /api/auth/login
router.post("/login", validateLogin, login);

export default router;
