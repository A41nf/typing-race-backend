// ─────────────────────────────────────────────────────────
// src/routes/tournament.routes.js — Tournament management
// ─────────────────────────────────────────────────────────

import { Router } from "express";
import {
  create,
  list,
  getOne,
  getCurrent,
  start,
  submitRoundResult,
  advance,
} from "../controllers/tournament.controller.js";
import { requireAdmin, requirePlayer } from "../middleware/auth.js";
import { validateTournamentCreate } from "../middleware/validate.js";

const router = Router();

// POST /api/tournaments  (admin)
router.post("/", requireAdmin, validateTournamentCreate, create);

// GET /api/tournaments
router.get("/", list);

// GET /api/tournaments/:id
router.get("/:id", getOne);

// GET /api/tournaments/:id/current-round
router.get("/:id/current-round", getCurrent);

// POST /api/tournaments/:id/start  (admin)
router.post("/:id/start", requireAdmin, start);

// POST /api/tournaments/:id/result  (player auth)
router.post("/:id/result", requirePlayer, submitRoundResult);

// POST /api/tournaments/:id/advance  (admin)
router.post("/:id/advance", requireAdmin, advance);

export default router;
