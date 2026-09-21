import mongoose from "mongoose";
import { setupStage4 } from "../migrations/stage4.js";
const args = process.argv.slice(2);
const database = args[args.indexOf("--database") + 1];
const uri = process.env.MIGRATION_MONGO_URI || process.env.MONGO_URI;
try {
  const configured = uri?.match(/^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]+)/)?.[1];
  if (!args.includes("--database") || !database || decodeURIComponent(configured || "") !== database) throw new Error("Supply --database with the exact database named in MIGRATION_MONGO_URI or MONGO_URI.");
  await mongoose.connect(uri, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000 });
  console.log(JSON.stringify(await setupStage4(mongoose.connection, { apply: args.includes("--apply") }), null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await mongoose.disconnect(); }
