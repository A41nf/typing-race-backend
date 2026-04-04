// ─────────────────────────────────────────────────────────
// src/models/mongo/result.schema.js — Result Collection
// ─────────────────────────────────────────────────────────
//
// Collection: results
//
// Document shape:
// {
//   _id: ObjectId,
//   playerId: "P001",          // → Player.playerId
//   raceId: ObjectId,          // → Race._id (null for free practice)
//   round: 1,                  // round within race (null for free)
//   wpm: 35,
//   accuracy: 92,
//   score: 322,
//   time: 45.2,                // seconds (float)
//   correctChars: 180,
//   totalKeystrokes: 196,
//   textLength: 114,           // characters in the race text
//   textId: 3,                 // index into RACE_TEXTS
//   isFinished: true,          // false if timed out
//   createdAt: Date,
// }
// ─────────────────────────────────────────────────────────

import mongoose from "mongoose";

const resultSchema = new mongoose.Schema(
  {
    playerId: {
      type: String,
      required: [true, "رقم اللاعب مطلوب"],
      uppercase: true,
      trim: true,
      ref: "Player",
    },

    raceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Race",
      default: null, // null = free practice
    },

    round: {
      type: Number,
      default: null, // null = free practice
      min: [1, "الجولة يجب أن تكون 1 أو أكثر"],
      max: [3, "الجولة لا تتجاوز 3"],
    },

    wpm: {
      type: Number,
      required: true,
      min: [0, "WPM لا يمكن أن يكون سالباً"],
      max: [500, "WPM غير واقعي"],
    },

    accuracy: {
      type: Number,
      required: true,
      min: [0, "الدقة لا يمكن أن تكون سالبة"],
      max: [100, "الدقة لا يمكن أن تتجاوز 100%"],
    },

    score: {
      type: Number,
      required: true,
      min: [0, "النتيجة لا يمكن أن تكون سالبة"],
      max: [10000, "النتيجة غير واقعية"],
    },

    time: {
      type: Number,
      required: true,
      min: [0, "الوقت لا يمكن أن يكون سالباً"],
      max: [300, "الوقت غير واقعي"],
    },

    correctChars: {
      type: Number,
      required: true,
      min: 0,
    },

    totalKeystrokes: {
      type: Number,
      required: true,
      min: 0,
    },

    textLength: {
      type: Number,
      default: 0,
    },

    textId: {
      type: Number,
      default: null,
    },

    isFinished: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// ── Indexes ──
resultSchema.index({ playerId: 1, createdAt: -1 });
resultSchema.index({ raceId: 1, round: 1 });
resultSchema.index({ score: -1 });
resultSchema.index({ wpm: -1 });
resultSchema.index({ createdAt: -1 });

// ── Compound: get results for a player within a specific race ──
resultSchema.index({ raceId: 1, playerId: 1 });

// ── Static: get top results for a race/round ──
resultSchema.statics.getRoundResults = function (raceId, round) {
  return this.find({ raceId, round })
    .sort({ score: -1 })
    .populate("playerId", "name school avatar")
    .lean();
};

// ── Static: get player's best results ──
resultSchema.statics.getPlayerBest = function (playerId, limit = 10) {
  return this.find({ playerId })
    .sort({ score: -1 })
    .limit(limit)
    .lean();
};

// ── Static: global leaderboard from results (not player stats) ──
resultSchema.statics.getGlobalTop = function (sort = "score", limit = 50) {
  const sortMap = { score: -1, wpm: -1, accuracy: -1 };
  const dir = sortMap[sort] || -1;

  return this.aggregate([
    { $sort: { [sort || "score"]: dir } },
    { $group: {
        _id: "$playerId",
        bestScore: { $max: "$score" },
        bestWPM: { $max: "$wpm" },
        bestAccuracy: { $max: "$accuracy" },
        races: { $sum: 1 },
        latestResult: { $first: "$$ROOT" },
    }},
    { $sort: { [sort === "wpm" ? "bestWPM" : sort === "accuracy" ? "bestAccuracy" : "bestScore"]: -1 } },
    { $limit: limit },
  ]);
};

export const Result = mongoose.model("Result", resultSchema);
