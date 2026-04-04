// ─────────────────────────────────────────────────────────
// src/routes/result.routes.js — Race results
// ─────────────────────────────────────────────────────────

import { Router } from "express";
import {
  submitResult,
  getMyResults,
  getPlayerResults,
  getTournamentResults,
} from "../controllers/result.controller.js";
import { requirePlayer } from "../middleware/auth.js";
import { validateResult } from "../middleware/validate.js";

const router = Router();

// POST /api/results  (auth required)
router.post("/", requirePlayer, validateResult, submitResult);

// GET /api/results/me  (auth required)
router.get("/me", requirePlayer, getMyResults);

// GET /api/results/player/:id
router.get("/player/:id", getPlayerResults);

// GET /api/results/tournament/:id
router.get("/tournament/:id", getTournamentResults);

export default router;
