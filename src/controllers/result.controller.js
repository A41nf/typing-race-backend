// ─────────────────────────────────────────────────────────
// src/controllers/result.controller.js
// ─────────────────────────────────────────────────────────

import {
  createResult,
  getResultsByPlayer,
  getTopResults,
  getResultsByTournament,
} from "../models/result.model.js";
import { updatePlayerStats } from "../models/player.model.js";

/**
 * POST /api/results
 * Body: { wpm, accuracy, score, time, correctChars, totalKeys, textId?, tournamentId?, round? }
 * Auth: required (X-Player-Id + X-Player-Pin)
 */
export function submitResult(req, res) {
  const player = req.player; // set by requirePlayer middleware
  const { wpm, accuracy, score, time, correctChars, totalKeys, textId, tournamentId, round } = req.body;

  // Save result
  const result = createResult({
    playerId: player.id,
    tournamentId: tournamentId || null,
    round: round || null,
    wpm,
    accuracy,
    score,
    time,
    correctChars,
    totalKeys,
    textId: textId || null,
  });

  // Update player's best stats
  const updatedPlayer = updatePlayerStats(player.id, { score, wpm, accuracy });

  res.status(201).json({
    success: true,
    result,
    player: {
      id: updatedPlayer.id,
      bestScore: updatedPlayer.score,
      bestWPM: updatedPlayer.wpm,
      bestAccuracy: updatedPlayer.accuracy,
      totalRaces: updatedPlayer.races,
    },
  });
}

/**
 * GET /api/results/me
 * Auth: required
 * Returns: all results for the logged-in player
 */
export function getMyResults(req, res) {
  const results = getResultsByPlayer(req.player.id);
  res.json({
    playerId: req.player.id,
    count: results.length,
    results,
  });
}

/**
 * GET /api/results/player/:id
 * Returns: all results for a specific player
 */
export function getPlayerResults(req, res) {
  const results = getResultsByPlayer(req.params.id);
  res.json({
    playerId: req.params.id,
    count: results.length,
    results,
  });
}

/**
 * GET /api/results/tournament/:id
 * Returns: all results for a specific tournament
 */
export function getTournamentResults(req, res) {
  const results = getResultsByTournament(req.params.id);
  res.json({
    tournamentId: req.params.id,
    count: results.length,
    results,
  });
}
