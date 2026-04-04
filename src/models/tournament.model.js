// ─────────────────────────────────────────────────────────
// src/models/tournament.model.js — Tournament state machine
// ─────────────────────────────────────────────────────────
//
// Tournament flow:
//   Round 1 (Quarter): 10 players → top 6 advance
//   Round 2 (Semi):     6 players → top 3 advance
//   Round 3 (Final):    3 players → winner decided
//
// Schema:
//   id:        string   (nanoid)
//   name:      string
//   status:    "waiting" | "round_1" | "round_2" | "round_3" | "finished"
//   rounds:    Array<{
//     number:     1 | 2 | 3
//     name:       string  ("ربع النهائي" | "نصف النهائي" | "النهائي")
//     maxAdvance: number  (how many advance)
//     players:    string[] (player IDs)
//     results:    string[] (result IDs)
//     status:     "pending" | "active" | "finished"
//   }>
//   winner:    string | null (player ID)
//   createdAt: ISO string
//   finishedAt: ISO string | null
// ─────────────────────────────────────────────────────────

import { nanoid } from "nanoid";

const tournaments = new Map();

const ROUND_CONFIG = [
  { number: 1, name: "ربع النهائي",  maxAdvance: 6 },
  { number: 2, name: "نصف النهائي",  maxAdvance: 3 },
  { number: 3, name: "النهائي",       maxAdvance: 1 },
];

export function createTournament(name = "سباق الكتابة") {
  const id = nanoid(8);

  const tournament = {
    id,
    name,
    status: "waiting",
    rounds: ROUND_CONFIG.map((cfg) => ({
      number: cfg.number,
      name: cfg.name,
      maxAdvance: cfg.maxAdvance,
      players: [],
      results: [],
      status: "pending",
    })),
    winner: null,
    createdAt: new Date().toISOString(),
    finishedAt: null,
  };

  tournaments.set(id, tournament);
  return tournament;
}

export function getTournament(id) {
  return tournaments.get(id) || null;
}

export function getAllTournaments() {
  return Array.from(tournaments.values());
}

/**
 * Start Round 1 with a set of player IDs.
 * Max 10 players for round 1.
 */
export function startRound1(tournamentId, playerIds) {
  const t = tournaments.get(tournamentId);
  if (!t) throw new Error("TOURNAMENT_NOT_FOUND");
  if (t.status !== "waiting") throw new Error("TOURNAMENT_ALREADY_STARTED");
  if (playerIds.length < 3) throw new Error("MIN_3_PLAYERS");
  if (playerIds.length > 10) throw new Error("MAX_10_PLAYERS");

  t.rounds[0].players = [...playerIds];
  t.rounds[0].status = "active";
  t.status = "round_1";

  return t;
}

/**
 * Record a result for the current round.
 * Returns the tournament.
 */
export function recordRoundResult(tournamentId, resultId) {
  const t = tournaments.get(tournamentId);
  if (!t) throw new Error("TOURNAMENT_NOT_FOUND");

  const roundIndex = getCurrentRoundIndex(t);
  if (roundIndex === -1) throw new Error("NO_ACTIVE_ROUND");

  t.rounds[roundIndex].results.push(resultId);
  return t;
}

/**
 * Finish the current round.
 * Advances top N players to the next round.
 * If final round, sets winner.
 *
 * @param {Array<{ playerId: string, score: number }>} rankedResults — sorted DESC by score
 */
export function finishCurrentRound(tournamentId, rankedResults) {
  const t = tournaments.get(tournamentId);
  if (!t) throw new Error("TOURNAMENT_NOT_FOUND");

  const roundIndex = getCurrentRoundIndex(t);
  if (roundIndex === -1) throw new Error("NO_ACTIVE_ROUND");

  const round = t.rounds[roundIndex];
  round.status = "finished";

  // Determine who advances
  const advancing = rankedResults
    .slice(0, round.maxAdvance)
    .map((r) => r.playerId);

  if (roundIndex < 2) {
    // Next round
    const nextRound = t.rounds[roundIndex + 1];
    nextRound.players = advancing;
    nextRound.status = "active";
    t.status = `round_${roundIndex + 2}`;
  } else {
    // Final round — tournament over
    t.winner = advancing[0]; // top scorer
    t.status = "finished";
    t.finishedAt = new Date().toISOString();
  }

  return t;
}

/**
 * Get the current active round index (0-based), or -1.
 */
function getCurrentRoundIndex(t) {
  return t.rounds.findIndex((r) => r.status === "active");
}

export function getCurrentRound(t) {
  const idx = getCurrentRoundIndex(t);
  return idx === -1 ? null : { ...t.rounds[idx], index: idx };
}

export function getTournamentStandings(tournamentId) {
  const t = tournaments.get(tournamentId);
  if (!t) throw new Error("TOURNAMENT_NOT_FOUND");

  return {
    id: t.id,
    name: t.name,
    status: t.status,
    winner: t.winner,
    rounds: t.rounds.map((r) => ({
      number: r.number,
      name: r.name,
      status: r.status,
      playerCount: r.players.length,
      maxAdvance: r.maxAdvance,
      resultCount: r.results.length,
    })),
  };
}

export function resetAllTournaments() {
  tournaments.clear();
}
