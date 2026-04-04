// ─────────────────────────────────────────────────────────
// src/models/mongo/race.schema.js — Race Collection
// ─────────────────────────────────────────────────────────
//
// Collection: races
//
// A Race = one competitive session within a tournament round.
// Tournament structure:
//   Round 1 (ربع النهائي): 10 players → top 6 advance
//   Round 2 (نصف النهائي):  6 players → top 3 advance
//   Round 3 (النهائي):       3 players → 1 winner
//
// Document shape:
// {
//   _id: ObjectId,
//   tournamentName: "بطولة شمس المعارف",
//   round: 1,                    // 1=quarter, 2=semi, 3=final
//   roundName: "ربع النهائي",
//   maxAdvance: 6,               // how many advance from this round
//   status: "waiting",
//   players: [
//     {
//       playerId: "P001",
//       name: "أحمد محمد",
//       school: "شمس المعارف",
//       avatar: "🧑‍🎓",
//       ready: false,
//       progress: 0,
//       finished: false,
//       resultId: null,           // → Result._id after race
//     }
//   ],
//   text: "...",                 // the race text (same for all)
//   textId: 3,                   // index into RACE_TEXTS
//   textLength: 114,
//   maxDuration: 120,            // seconds
//   startedAt: Date,
//   finishedAt: Date,
//   winner: {                    // populated after race_end
//     playerId: "P001",
//     name: "أحمد محمد",
//     score: 2370,
//   },
//   standings: [                 // final sorted results
//     { rank: 1, playerId: "P001", name: "...", score: 2370, ... },
//   ],
//   createdAt: Date,
//   updatedAt: Date,
// }
// ─────────────────────────────────────────────────────────

import mongoose from "mongoose";

const ROUND_NAMES = {
  1: "ربع النهائي",
  2: "نصف النهائي",
  3: "النهائي",
};

const ROUND_ADVANCE = {
  1: 6,
  2: 3,
  3: 1,
};

// ── Embedded player in race ──
const racePlayerSchema = new mongoose.Schema(
  {
    playerId: { type: String, required: true, uppercase: true },
    name:     { type: String, required: true },
    school:   { type: String, default: "شمس المعارف" },
    avatar:   { type: String, default: "🧑‍🎓" },
    ready:    { type: Boolean, default: false },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    finished: { type: Boolean, default: false },
    resultId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Result",
      default: null,
    },
  },
  { _id: false }
);

// ── Embedded standing ──
const standingSchema = new mongoose.Schema(
  {
    rank:    { type: Number, required: true },
    playerId:{ type: String, required: true },
    name:    { type: String, required: true },
    school:  { type: String, default: "" },
    avatar:  { type: String, default: "" },
    score:   { type: Number, default: 0 },
    wpm:     { type: Number, default: 0 },
    accuracy:{ type: Number, default: 0 },
    time:    { type: Number, default: 0 },
    finished:{ type: Boolean, default: false },
  },
  { _id: false }
);

// ── Embedded winner ──
const winnerSchema = new mongoose.Schema(
  {
    playerId: { type: String, required: true },
    name:     { type: String, required: true },
    score:    { type: Number, default: 0 },
    wpm:      { type: Number, default: 0 },
  },
  { _id: false }
);

// ── Main race schema ──
const raceSchema = new mongoose.Schema(
  {
    tournamentName: {
      type: String,
      required: true,
      default: "بطولة شمس المعارف",
      trim: true,
    },

    round: {
      type: Number,
      required: true,
      min: [1, "الجولة يجب أن تكون 1 على الأقل"],
      max: [3, "الجولة لا تتجاوز 3"],
    },

    roundName: {
      type: String,
    },

    maxAdvance: {
      type: Number,
    },

    status: {
      type: String,
      enum: {
        values: ["waiting", "countdown", "racing", "finished", "cancelled"],
        message: "حالة غير صالحة",
      },
      default: "waiting",
    },

    players: {
      type: [racePlayerSchema],
      validate: {
        validator: (v) => v.length >= 2 && v.length <= 10,
        message: "عدد اللاعبين يجب أن يكون بين 2 و 10",
      },
    },

    text: {
      type: String,
      default: "",
    },

    textId: {
      type: Number,
      default: null,
    },

    textLength: {
      type: Number,
      default: 0,
    },

    maxDuration: {
      type: Number,
      default: 120,
    },

    startedAt: {
      type: Date,
      default: null,
    },

    finishedAt: {
      type: Date,
      default: null,
    },

    winner: {
      type: winnerSchema,
      default: null,
    },

    standings: {
      type: [standingSchema],
      default: [],
    },

    // ── Metadata ──
    createdBy: {
      type: String,
      default: "admin",
    },
  },
  {
    timestamps: true,
  }
);

// ── Pre-save: auto-fill roundName and maxAdvance ──
raceSchema.pre("save", function (next) {
  if (this.isModified("round")) {
    this.roundName = ROUND_NAMES[this.round] || `الجولة ${this.round}`;
    this.maxAdvance = ROUND_ADVANCE[this.round] || 1;
  }
  next();
});

// ── Indexes ──
raceSchema.index({ round: 1 });
raceSchema.index({ status: 1 });
raceSchema.index({ createdAt: -1 });
raceSchema.index({ "players.playerId": 1 });
raceSchema.index({ tournamentName: 1, round: 1 });

// ── Instance method: add player ──
raceSchema.methods.addPlayer = function ({ playerId, name, school, avatar }) {
  if (this.status !== "waiting") throw new Error("RACE_ALREADY_STARTED");
  if (this.players.length >= 10) throw new Error("ROOM_FULL");
  if (this.players.find((p) => p.playerId === playerId)) {
    throw new Error("PLAYER_ALREADY_IN_RACE");
  }

  this.players.push({ playerId, name, school, avatar });
  return this.save();
};

// ── Instance method: set player ready ──
raceSchema.methods.setPlayerReady = function (playerId) {
  const player = this.players.find((p) => p.playerId === playerId);
  if (!player) throw new Error("PLAYER_NOT_IN_RACE");
  player.ready = true;
  return this.save();
};

// ── Instance method: check all ready ──
raceSchema.methods.allReady = function () {
  return this.players.length >= 2 && this.players.every((p) => p.ready);
};

// ── Instance method: start race ──
raceSchema.methods.startRace = function (text, textId) {
  if (!this.allReady()) throw new Error("NOT_ALL_READY");
  this.status = "racing";
  this.text = text;
  this.textId = textId;
  this.textLength = text.length;
  this.startedAt = new Date();
  return this.save();
};

// ── Instance method: update player progress ──
raceSchema.methods.updatePlayerProgress = function (playerId, progress) {
  const player = this.players.find((p) => p.playerId === playerId);
  if (!player) throw new Error("PLAYER_NOT_IN_RACE");
  player.progress = Math.min(progress, 100);
  return this.save();
};

// ── Instance method: finish race ──
raceSchema.methods.finishRace = function (standings) {
  this.status = "finished";
  this.finishedAt = new Date();
  this.standings = standings;

  if (standings.length > 0) {
    const top = standings[0];
    this.winner = {
      playerId: top.playerId,
      name: top.name,
      score: top.score,
      wpm: top.wpm,
    };
  }

  return this.save();
};

// ── Static: find active races for a player ──
raceSchema.statics.findActiveByPlayer = function (playerId) {
  return this.find({
    "players.playerId": playerId,
    status: { $in: ["waiting", "countdown", "racing"] },
  });
};

// ── Static: get race history ──
raceSchema.statics.getHistory = function (limit = 20) {
  return this.find({ status: "finished" })
    .select("tournamentName round roundName winner standings createdAt")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

export const Race = mongoose.model("Race", raceSchema);
