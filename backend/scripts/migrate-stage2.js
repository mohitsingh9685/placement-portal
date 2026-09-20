import mongoose from "mongoose";
import { planStage2, applyStage2, rollbackStage2 } from "../migrations/stage2.js";
const args = process.argv.slice(2);
const database = args[args.indexOf("--database") + 1];
const uri = process.env.MIGRATION_MONGO_URI || process.env.MONGO_URI;
try {
  const configuredName = uri?.match(/^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]+)/)?.[1];
  if (!args.includes("--database") || !database || decodeURIComponent(configuredName || "") !== database) {
    throw new Error("Supply --database with the exact database named in MIGRATION_MONGO_URI or MONGO_URI. No database is chosen implicitly.");
  }
  if (args.includes("--apply") && args.includes("--rollback")) throw new Error("Choose apply or rollback");
  await mongoose.connect(uri, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000 });
  const output = args.includes("--apply") ? await applyStage2(mongoose.connection)
    : args.includes("--rollback") ? await rollbackStage2(mongoose.connection)
    : await planStage2(mongoose.connection.db);
  const { operations, ...report } = output;
  console.log(JSON.stringify({ mode: args.includes("--apply") ? "apply" : args.includes("--rollback") ? "rollback" : "dry-run", database, ...report }, null, 2));
  if (output.conflicts?.length) process.exitCode = 1;
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await mongoose.disconnect(); }
