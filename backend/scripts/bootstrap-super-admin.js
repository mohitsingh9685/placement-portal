import mongoose from "mongoose";
import { bootstrapSuperAdmin } from "../services/adminManagementService.js";
const args = process.argv.slice(2);
const value = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const uri = process.env.MIGRATION_MONGO_URI || process.env.MONGO_URI;
try {
  const database = value("--database"), email = value("--email");
  const configured = uri?.match(/^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]+)/)?.[1];
  if (!database || decodeURIComponent(configured || "") !== database || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Provide --database matching the configured URI and --email for the existing admin");
  await mongoose.connect(uri, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000 });
  const run = await mongoose.connection.db.collection("migrationruns").findOne({ _id: "stage2-v1", status: "APPLIED", indexesReady: true });
  if (!run) throw new Error("Complete the stage 2 migration before bootstrapping a Super Admin");
  console.log(JSON.stringify({ mode: args.includes("--apply") ? "apply" : "dry-run", database,
    ...await bootstrapSuperAdmin(email, { apply: args.includes("--apply") }) }, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await mongoose.disconnect(); }
