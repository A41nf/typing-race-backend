// ─────────────────────────────────────────────────────────
// src/utils/seed-mongo.js — Seed MongoDB with sample data
// ─────────────────────────────────────────────────────────
//
// Usage:
//   node src/utils/seed-mongo.js
//   MONGO_URI=mongodb://... node src/utils/seed-mongo.js
// ─────────────────────────────────────────────────────────

import { connectDB, disconnectDB } from "./db.js";
import { Player } from "../models/mongo/player.schema.js";
import { Result } from "../models/mongo/result.schema.js";
import { Race } from "../models/mongo/race.schema.js";
import {
  samplePlayers,
  sampleResults,
  sampleRaces,
} from "../models/mongo/sample-data.js";

async function seed() {
  await connectDB();

  // Clear existing data
  console.log("\n🧹 Clearing existing data...");
  await Player.deleteMany({});
  await Result.deleteMany({});
  await Race.deleteMany({});

  // ── Seed Players ──
  console.log("\n👤 Seeding players...");
  const players = await Player.insertMany(samplePlayers);
  for (const p of players) {
    console.log(`   ✅ ${p.playerId} — ${p.name} (${p.stats.races} races, best: ${p.stats.bestScore})`);
  }

  // ── Seed Races ──
  console.log("\n🏁 Seeding races...");
  const races = await Race.insertMany(sampleRaces);
  for (const r of races) {
    console.log(`   ✅ Round ${r.round} (${r.roundName}) — ${r.players.length} players, winner: ${r.winner?.name || "N/A"}`);
  }

  // ── Seed Results (link to races) ──
  console.log("\n📊 Seeding results...");
  const raceIds = {
    RACE_ROUND_1: races[0]._id,
    RACE_ROUND_2: races[1]._id,
    RACE_ROUND_3: races[2]._id,
  };

  for (const r of sampleResults) {
    const result = await Result.create({
      ...r,
      raceId: raceIds[r.raceId] || null,
    });
    console.log(`   ✅ ${result.playerId} — Round ${result.round}: ${result.score}pts (${result.wpm}WPM)`);
  }

  // ── Summary ──
  const totalPlayers = await Player.countDocuments();
  const totalResults = await Result.countDocuments();
  const totalRaces = await Race.countDocuments();

  console.log(`\n${"═".repeat(50)}`);
  console.log(`  📦 Seed complete:`);
  console.log(`     👤 ${totalPlayers} players`);
  console.log(`     📊 ${totalResults} results`);
  console.log(`     🏁 ${totalRaces} races`);
  console.log(`${"═".repeat(50)}\n`);

  await disconnectDB();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
