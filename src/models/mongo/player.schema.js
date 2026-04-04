// ─────────────────────────────────────────────────────────
// src/models/mongo/player.schema.js — Player Collection
// ─────────────────────────────────────────────────────────
//
// Collection: players
//
// Document shape:
// {
//   _id: ObjectId,
//   playerId: "P001",          // human-readable ID (unique)
//   pin: "1234",               // 4-digit auth PIN (hashed in prod)
//   name: "أحمد محمد",
//   school: "شمس المعارف",
//   avatar: "🧑‍🎓",
//   stats: {
//     races: 0,
//     bestScore: 0,
//     bestWPM: 0,
//     bestAccuracy: 0,
//     avgScore: 0,
//     totalScore: 0,
//   },
//   tournamentIds: [],         // ObjectId[] → tournaments participated in
//   isActive: true,
//   createdAt: Date,
//   updatedAt: Date,
// }
// ─────────────────────────────────────────────────────────

import mongoose from "mongoose";

const statsSchema = new mongoose.Schema(
  {
    races:        { type: Number, default: 0, min: 0 },
    bestScore:    { type: Number, default: 0, min: 0 },
    bestWPM:      { type: Number, default: 0, min: 0 },
    bestAccuracy: { type: Number, default: 0, min: 0, max: 100 },
    avgScore:     { type: Number, default: 0, min: 0 },
    totalScore:   { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const playerSchema = new mongoose.Schema(
  {
    playerId: {
      type: String,
      required: [true, "رقم اللاعب مطلوب"],
      unique: true,
      uppercase: true,
      trim: true,
      match: [/^[A-Z0-9]{2,10}$/, "رقم اللاعب غير صالح"],
    },

    pin: {
      type: String,
      required: [true, "الرمز السري مطلوب"],
      minlength: [4, "الرمز السري يجب أن يكون 4 أرقام"],
      maxlength: [4, "الرمز السري يجب أن يكون 4 أرقام"],
      match: [/^\d{4}$/, "الرمز السري يجب أن يكون أرقاماً فقط"],
    },

    name: {
      type: String,
      required: [true, "اسم اللاعب مطلوب"],
      trim: true,
      minlength: [2, "الاسم قصير جداً"],
      maxlength: [50, "الاسم طويل جداً"],
    },

    school: {
      type: String,
      required: [true, "اسم المدرسة مطلوب"],
      trim: true,
      default: "شمس المعارف",
    },

    avatar: {
      type: String,
      default: "🧑‍🎓",
    },

    stats: {
      type: statsSchema,
      default: () => ({}),
    },

    tournamentIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Race",
      },
    ],

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Indexes ──
playerSchema.index({ playerId: 1 }, { unique: true });
playerSchema.index({ school: 1 });
playerSchema.index({ "stats.bestScore": -1 });
playerSchema.index({ "stats.bestWPM": -1 });
playerSchema.index({ isActive: 1 });

// ── Virtual: full display name ──
playerSchema.virtual("displayName").get(function () {
  return `${this.name} (${this.playerId})`;
});

// ── Instance method: verify PIN ──
playerSchema.methods.verifyPin = function (pin) {
  return this.pin === pin;
};

// ── Instance method: update stats after a race ──
playerSchema.methods.updateAfterRace = function ({ score, wpm, accuracy }) {
  this.stats.races += 1;
  this.stats.totalScore += score;
  this.stats.avgScore = Math.round(this.stats.totalScore / this.stats.races);
  if (score > this.stats.bestScore) this.stats.bestScore = score;
  if (wpm > this.stats.bestWPM) this.stats.bestWPM = wpm;
  if (accuracy > this.stats.bestAccuracy) this.stats.bestAccuracy = accuracy;
  return this.save();
};

// ── Static: find by credentials ──
playerSchema.statics.findByCredentials = function (playerId, pin) {
  return this.findOne({ playerId: playerId.toUpperCase(), pin, isActive: true });
};

// ── Static: leaderboard query ──
playerSchema.statics.getLeaderboard = function (sort = "score", limit = 20) {
  const sortMap = {
    score: { "stats.bestScore": -1 },
    wpm: { "stats.bestWPM": -1 },
    accuracy: { "stats.bestAccuracy": -1 },
  };
  const sortField = sortMap[sort] || sortMap.score;

  return this.find({ "stats.races": { $gt: 0 }, isActive: true })
    .select("playerId name school avatar stats")
    .sort(sortField)
    .limit(limit)
    .lean();
};

export const Player = mongoose.model("Player", playerSchema);
