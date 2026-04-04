// ─────────────────────────────────────────────────────────
// src/utils/seed.js — Seed demo players
// ─────────────────────────────────────────────────────────

import { createPlayer } from "../models/player.model.js";

const DEMO_PLAYERS = [
  { id: "P001", pin: "1234", name: "أحمد محمد",   school: "شمس المعارف", avatar: "🧑‍🎓" },
  { id: "P002", pin: "5678", name: "سارة علي",     school: "شمس المعارف", avatar: "👩‍🎓" },
  { id: "P003", pin: "9012", name: "يوسف حسن",     school: "شمس المعارف", avatar: "🧑‍🎓" },
  { id: "P004", pin: "3456", name: "مريم خالد",    school: "شمس المعارف", avatar: "👩‍🎓" },
  { id: "P005", pin: "7890", name: "عمر سعيد",     school: "شمس المعارف", avatar: "🧑‍🎓" },
  { id: "P006", pin: "2468", name: "نور الدين",    school: "شمس المعارف", avatar: "👩‍🎓" },
  { id: "P007", pin: "1357", name: "ليلى إبراهيم", school: "شمس المعارف", avatar: "👩‍🎓" },
  { id: "P008", pin: "8642", name: "كريم وليد",    school: "شمس المعارف", avatar: "🧑‍🎓" },
  { id: "P009", pin: "9753", name: "هند فاروق",    school: "شمس المعارف", avatar: "👩‍🎓" },
  { id: "P010", pin: "3141", name: "زيدان طارق",   school: "شمس المعارف", avatar: "🧑‍🎓" },
];

console.log("Seeding players...");

let created = 0;
for (const p of DEMO_PLAYERS) {
  try {
    await createPlayer(p);
    created++;
    console.log(`  ✅ ${p.id} — ${p.name}`);
  } catch (err) {
    console.log(`  ⏭️  ${p.id} — already exists`);
  }
}

console.log(`\nDone. ${created} players created.\n`);
