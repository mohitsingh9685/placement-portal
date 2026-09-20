import "dotenv/config";
import mongoose from "mongoose";
import { validateEnvironment } from "./config/env.js";
import connectDB from "./config/db.js";

try {
  validateEnvironment();
  const { createApp } = await import("./app.js");
  const { connectRedis } = await import("./config/redis.js");
  await connectDB();
  const migration = await mongoose.connection.db.collection("migrationruns").findOne({ _id: "stage2-v1", status: "APPLIED", indexesReady: true });
  if (!migration) throw new Error("Stage 2 migration is required. Follow STAGE_2_TESTING.md before starting this release.");
  const indexes = await mongoose.connection.db.collection("applications").listIndexes().toArray();
  if (!indexes.some(index => index.name === "student_drive_unique" && index.unique && index.key.student === 1 && index.key.drive === 1)) throw new Error("Stage 2 indexes are incomplete. Re-run the migration apply command.");
  connectRedis();
  createApp().listen(process.env.PORT || 9000, () => console.log("Placement API started"));
} catch (error) {
  console.error("Server failed to start:", error.message);
  await mongoose.disconnect();
  process.exitCode = 1;
}
