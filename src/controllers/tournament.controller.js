// ─────────────────────────────────────────────────────────
// src/controllers/tournament.controller.js
// ─────────────────────────────────────────────────────────

import {
  createTournament,
  getTournament,
  getAllTournaments,
  startRound1,
  finishCurrentRound,
  getCurrentRound,
  getTournamentStandings,
  recordRoundResult,
} from "../models/tournament.model.js";
import { createResult, getResultsByRound } from "../models/result.model.js";
import { updatePlayerStats, getPlayer } from "../models/player.model.js";

/**
 * POST /api/tournaments
 * Body: { name?, playerIds? }
 * Admin only — create a new tournament.
 */
export function create(req, res) {
  const { name, playerIds } = req.body;

  const tournament = createTournament(name || "سباق الكتابة");

  // If player IDs provided, start round 1 immediately
  if (playerIds && playerIds.length >= 3) {
    startRound1(tournament.id, playerIds);
  }

  res.status(201).json({ success: true, tournament });
}

/**
 * GET /api/tournaments
 * Returns: all tournaments
 */
export function list(_req, res) {
  const tournaments = getAllTournaments();
  res.json({ count: tournaments.length, tournaments });
}

/**
 * GET /api/tournaments/:id
 * Returns: tournament with standings
 */
export function getOne(req, res) {
  const standings = getTournamentStandings(req.params.id);
  res.json({ tournament: standings });
}

/**
 * GET /api/tournaments/:id/current-round
 * Returns: current active round info
 */
export async function getCurrent(req, res) {
  const t = getTournament(req.params.id);
  if (!t) {
    return res.status(404).json({
      error: "TOURNAMENT_NOT_FOUND",
      message: "البطولة غير موجودة",
    });
  }

  const round = getCurrentRound(t);
  if (!round) {
    return res.json({
      tournamentId: t.id,
      status: t.status,
      message: t.status === "finished" ? "البطولة انتهت" : "البطولة لم تبدأ بعد",
      winner: t.winner,
    });
  }

  // Include player info
  const players = await Promise.all(round.players.map(async (pid) => {
    const p = await getPlayer(pid);
    return p ? { id: p.id, name: p.name, avatar: p.avatar, school: p.school } : { id: pid };
  }));

  res.json({
    tournamentId: t.id,
    round: round.number,
    roundName: round.name,
    status: round.status,
    players,
    maxAdvance: round.maxAdvance,
    resultCount: round.results.length,
  });
}

/**
 * POST /api/tournaments/:id/start
 * Body: { playerIds: string[] }
 * Admin — start round 1 with given players.
 */
export function start(req, res) {
  const { playerIds } = req.body;

  if (!playerIds || !Array.isArray(playerIds) || playerIds.length < 3) {
    return res.status(400).json({
      error: "INVALID_PLAYERS",
      message: "يجب تحديد 3 لاعبين على الأقل",
    });
  }

  const tournament = startRound1(req.params.id, playerIds);
  res.json({ success: true, tournament });
}

/**
 * POST /api/tournaments/:id/result
 * Body: { playerId, wpm, accuracy, score, time, correctChars, totalKeys }
 * Auth: required
 *
 * Records a race result for the current tournament round.
 */
export async function submitRoundResult(req, res) {
  const t = getTournament(req.params.id);
  if (!t) {
    return res.status(404).json({
      error: "TOURNAMENT_NOT_FOUND",
      message: "البطولة غير موجودة",
    });
  }

  const round = getCurrentRound(t);
  if (!round) {
    return res.status(400).json({
      error: "NO_ACTIVE_ROUND",
      message: "لا توجد جولة نشطة",
    });
  }

  const { playerId, wpm, accuracy, score, time, correctChars, totalKeys } = req.body;

  // Verify player is in this round
  if (!round.players.includes(playerId)) {
    return res.status(403).json({
      error: "PLAYER_NOT_IN_ROUND",
      message: "اللاعب غير مسجل في هذه الجولة",
    });
  }

  // Create result
  const result = createResult({
    playerId,
    tournamentId: t.id,
    round: round.number,
    wpm,
    accuracy,
    score,
    time,
    correctChars,
    totalKeys,
  });

  // Update player stats
  await updatePlayerStats(playerId, { score, wpm, accuracy });

  // Record in tournament
  recordRoundResult(t.id, result.id);

  res.status(201).json({
    success: true,
    result,
    round: {
      number: round.number,
      name: round.name,
      submitted: round.results.length + 1,
      total: round.players.length,
    },
  });
}

/**
 * POST /api/tournaments/:id/advance
 * Admin — finish current round, advance top N to next round.
 */
export async function advance(req, res) {
  const t = getTournament(req.params.id);
  if (!t) {
    return res.status(404).json({
      error: "TOURNAMENT_NOT_FOUND",
      message: "البطولة غير موجودة",
    });
  }

  const round = getCurrentRound(t);
  if (!round) {
    return res.status(400).json({
      error: "NO_ACTIVE_ROUND",
      message: "لا توجد جولة نشطة",
    });
  }

  // Get results for this round, ranked
  const roundResults = getResultsByRound(t.id, round.number);
  if (roundResults.length === 0) {
    return res.status(400).json({
      error: "NO_RESULTS",
      message: "لم يتم إرسال أي نتائج لهذه الجولة بعد",
    });
  }

  const ranked = roundResults.map((r) => ({
    playerId: r.playerId,
    score: r.score,
  }));

  const updated = finishCurrentRound(t.id, ranked);

  res.json({
    success: true,
    tournament: updated,
    advanced: await Promise.all(ranked.slice(0, round.maxAdvance).map(async (r) => {
      const p = await getPlayer(r.playerId);
      return {
        playerId: r.playerId,
        name: p?.name,
        score: r.score,
      };
    })),
    nextStatus: updated.status,
  });
}
