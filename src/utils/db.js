// ─────────────────────────────────────────────────────────
// src/utils/db.js — MongoDB connection
// ─────────────────────────────────────────────────────────

import mongoose from "mongoose";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/typing-race";

export async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log(`📦 MongoDB connected: ${mongoose.connection.name}`);

    mongoose.connection.on("error", (err) => {
      console.error("MongoDB error:", err);
    });

    mongoose.connection.on("disconnected", () => {
      console.warn("📦 MongoDB disconnected");
    });

    return mongoose.connection;
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  }
}

export async function disconnectDB() {
  await mongoose.disconnect();
}
