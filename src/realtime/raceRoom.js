// ─────────────────────────────────────────────────────────
// src/realtime/raceRoom.js — Race room state machine
// ─────────────────────────────────────────────────────────
//
// Room lifecycle:
//
//   ┌──────────┐   all ready    ┌───────────┐  countdown  ┌─────────┐
//   │ WAITING  │ ─────────────→ │ COUNTDOWN │ ──────────→ │  RACING │
//   └──────────┘                └───────────┘             └─────────┘
//        ↑                                                      │
//        │                all finished OR timeout               │
//        │           ┌──────────────────────────────────────────┘
//        │           ▼
//        │      ┌─────────┐
//        └──────│ FINISHED│
//               └─────────┘
//
// State per room:
//   roomId       string
//   status       "waiting" | "countdown" | "racing" | "finished"
//   text         string        (same for all players)
//   textId       number        (index into RACE_TEXTS)
//   players      Map<socketId, { id, name, school, avatar, ready, progress, finished, stats }>
//   maxPlayers   number        (default 10)
//   countdown    number|null   (current countdown value)
//   raceTimer    Timeout|null  (server-side race timeout)
//   startedAt    number|null   (Date.now() when race started)
//   maxDuration  number        (seconds, default 120)
//   createdAt    number
// ─────────────────────────────────────────────────────────

import { nanoid } from "nanoid";
import { RACE_TEXTS } from "../data/texts.js";

const MAX_PLAYERS = 10;
const MAX_DURATION = 120; // seconds
const COUNTDOWN_INTERVAL_MS = 1000;

export class RaceRoom {
  constructor(roomId = null) {
    this.roomId = roomId || nanoid(6);
    this.status = "waiting";
    this.text = "";
    this.textId = null;
    this.players = new Map();
    this.maxPlayers = MAX_PLAYERS;
    this.countdown = null;
    this.raceTimer = null;
    this.countdownTimer = null;
    this.startedAt = null;
    this.maxDuration = MAX_DURATION;
    this.createdAt = Date.now();
  }

  // ── Player management ──

  addPlayer(socketId, { id, name, school, avatar }) {
    if (this.status !== "waiting") {
      throw new Error("RACE_ALREADY_STARTED");
    }
    if (this.players.size >= this.maxPlayers) {
      throw new Error("ROOM_FULL");
    }
    // Check for duplicate player ID
    for (const [, p] of this.players) {
      if (p.id === id) throw new Error("PLAYER_ALREADY_IN_ROOM");
    }

    this.players.set(socketId, {
      id,
      name,
      school,
      avatar,
      ready: false,
      progress: 0,
      finished: false,
      stats: null,
      joinedAt: Date.now(),
    });

    return this.getPlayerList();
  }

  removePlayer(socketId) {
    const player = this.players.get(socketId);
    this.players.delete(socketId);

    // If room is empty, mark for cleanup
    if (this.players.size === 0) {
      this.cleanup();
      return { removed: player, empty: true };
    }

    return { removed: player, empty: false, players: this.getPlayerList() };
  }

  setReady(socketId) {
    const player = this.players.get(socketId);
    if (!player) throw new Error("PLAYER_NOT_IN_ROOM");
    if (this.status !== "waiting") throw new Error("NOT_IN_WAITING");

    player.ready = true;
    return {
      playerId: player.id,
      allReady: this.isAllReady(),
      players: this.getPlayerList(),
    };
  }

  isAllReady() {
    if (this.players.size < 2) return false;
    for (const [, p] of this.players) {
      if (!p.ready) return false;
    }
    return true;
  }

  // ── Race lifecycle ──

  selectText() {
    const idx = Math.floor(Math.random() * RACE_TEXTS.length);
    this.text = RACE_TEXTS[idx];
    this.textId = idx;
    return this.text;
  }

  /**
   * Start countdown → returns callback to emit each step.
   * Calls onCountdown(step) for each number, onStart() when done.
   */
  startCountdown(onCountdown, onStart, countdownSteps = [3, 2, 1]) {
    if (!this.isAllReady()) throw new Error("NOT_ALL_READY");
    if (this.status !== "waiting") throw new Error("INVALID_STATE");

    this.status = "countdown";
    this.selectText();

    let step = 0;
    const tick = () => {
      if (step < countdownSteps.length) {
        this.countdown = countdownSteps[step];
        onCountdown(countdownSteps[step], step);
        step++;
        this.countdownTimer = setTimeout(tick, COUNTDOWN_INTERVAL_MS);
      } else {
        // Start the race
        this.status = "racing";
        this.startedAt = Date.now();
        this.countdown = null;
        onStart();

        // Server-side timeout
        this.raceTimer = setTimeout(() => {
          this.finishRace();
        }, this.maxDuration * 1000);
      }
    };

    tick();
  }

  /**
   * Update player progress during race.
   * Returns { progress, wpm, accuracy, finished, allFinished }
   */
  updateProgress(socketId, { typed, correctChars, totalKeystrokes, elapsed }) {
    if (this.status !== "racing") throw new Error("RACE_NOT_ACTIVE");

    const player = this.players.get(socketId);
    if (!player) throw new Error("PLAYER_NOT_IN_ROOM");
    if (player.finished) throw new Error("ALREADY_FINISHED");

    const typedLength = typeof typed === "string" ? typed.length : Number(typed) || 0;

    const progress = Math.min(
      Math.round((typedLength / this.text.length) * 100),
      100
    );

    const wpm =
      elapsed > 0
        ? Math.round((correctChars / 5 / elapsed) * 60)
        : 0;

    const accuracy =
      totalKeystrokes > 0
        ? Math.round((correctChars / totalKeystrokes) * 100)
        : 100;

    const score = Math.round(wpm * (accuracy / 100) * 10);

    player.progress = progress;

    // Check if player finished (typed all characters)
    if (typedLength >= this.text.length) {
      player.finished = true;
      player.stats = { wpm, accuracy, score, time: elapsed, correctChars, totalKeystrokes };
    }

    return {
      playerId: player.id,
      progress,
      wpm,
      accuracy,
      score,
      finished: player.finished,
      allFinished: this.isAllFinished(),
    };
  }

  /**
   * Mark player as finished with final stats.
   */
  finishPlayer(socketId, stats) {
    const player = this.players.get(socketId);
    if (!player) throw new Error("PLAYER_NOT_IN_ROOM");

    player.finished = true;
    player.progress = 100;
    player.stats = {
      wpm: Math.round(stats.wpm),
      accuracy: Math.round(stats.accuracy),
      score: Math.round(stats.score),
      time: Math.round(stats.time * 10) / 10,
      correctChars: stats.correctChars,
      totalKeystrokes: stats.totalKeystrokes,
    };

    return {
      playerId: player.id,
      finished: true,
      stats: player.stats,
      allFinished: this.isAllFinished(),
    };
  }

  isAllFinished() {
    for (const [, p] of this.players) {
      if (!p.finished) return false;
    }
    return true;
  }

  /**
   * End the race — compute final standings.
   */
  finishRace() {
    clearTimeout(this.raceTimer);
    clearTimeout(this.countdownTimer);
    this.status = "finished";

    const standings = [];
    for (const [socketId, p] of this.players) {
      standings.push({
        socketId,
        playerId: p.id,
        name: p.name,
        school: p.school,
        avatar: p.avatar,
        finished: p.finished,
        progress: p.progress,
        stats: p.stats || {
          wpm: 0,
          accuracy: 0,
          score: 0,
          time: this.maxDuration,
          correctChars: 0,
          totalKeystrokes: 0,
        },
      });
    }

    // Sort: finished first, then by score DESC
    standings.sort((a, b) => {
      if (a.finished !== b.finished) return b.finished - a.finished;
      return b.stats.score - a.stats.score;
    });

    // Assign ranks
    standings.forEach((s, i) => {
      s.rank = i + 1;
    });

    return {
      roomId: this.roomId,
      standings,
      text: this.text,
      textId: this.textId,
      duration: this.startedAt ? (Date.now() - this.startedAt) / 1000 : 0,
    };
  }

  // ── Queries ──

  getPlayerList() {
    const list = [];
    for (const [socketId, p] of this.players) {
      list.push({
        socketId,
        playerId: p.id,
        name: p.name,
        school: p.school,
        avatar: p.avatar,
        ready: p.ready,
        progress: p.progress,
        finished: p.finished,
      });
    }
    return list;
  }

  getPublicState() {
    return {
      roomId: this.roomId,
      status: this.status,
      playerCount: this.players.size,
      maxPlayers: this.maxPlayers,
      players: this.getPlayerList(),
      countdown: this.countdown,
      textPreview: this.text ? this.text.substring(0, 50) + "..." : null,
      textLength: this.text ? this.text.length : 0,
      maxDuration: this.maxDuration,
    };
  }

  cleanup() {
    clearTimeout(this.raceTimer);
    clearTimeout(this.countdownTimer);
  }
}

// ── Room registry ──

const rooms = new Map();
const playerRooms = new Map(); // socketId → roomId

export function createRoom(roomId) {
  const room = new RaceRoom(roomId);
  rooms.set(room.roomId, room);
  return room;
}

export function getRoom(roomId) {
  return rooms.get(roomId) || null;
}

export function getOrCreateDefaultRoom() {
  // Find a waiting room with space, or create one
  for (const [, room] of rooms) {
    if (room.status === "waiting" && room.players.size < room.maxPlayers) {
      return room;
    }
  }
  return createRoom();
}

export function deleteRoom(roomId) {
  const room = rooms.get(roomId);
  if (room) {
    room.cleanup();
    rooms.delete(roomId);
  }
}

export function getPlayerRoom(socketId) {
  const roomId = playerRooms.get(socketId);
  return roomId ? rooms.get(roomId) || null : null;
}

export function setPlayerRoom(socketId, roomId) {
  playerRooms.set(socketId, roomId);
}

export function clearPlayerRoom(socketId) {
  playerRooms.delete(socketId);
}

export function getAllRooms() {
  return Array.from(rooms.values()).map((r) => r.getPublicState());
}
