// ─────────────────────────────────────────────────────────
// src/routes/index.js — Route aggregator
// ─────────────────────────────────────────────────────────

import { Router } from "express";
import authRoutes from "./auth.routes.js";
import playerRoutes from "./player.routes.js";
import resultRoutes from "./result.routes.js";
import leaderboardRoutes from "./leaderboard.routes.js";
import tournamentRoutes from "./tournament.routes.js";

const router = Router();

// Health check
router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "typing-race-backend",
    school: "مدرسة شمس المعارف للتعليم الأساسي",
    time: new Date().toISOString(),
  });
});

// Mount sub-routers
router.use("/auth",       authRoutes);
router.use("/players",    playerRoutes);
router.use("/results",    resultRoutes);
router.use("/leaderboard", leaderboardRoutes);
router.use("/tournaments", tournamentRoutes);

export default router;
