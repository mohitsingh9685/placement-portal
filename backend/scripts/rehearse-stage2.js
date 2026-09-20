import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import mongoose from "mongoose";
import { planStage2, applyStage2, rollbackStage2 } from "../migrations/stage2.js";

// The source client only reads. All writes and cleanup use a newly named,
// loopback-only database; no source credentials or records are printed.
const args = process.argv.slice(2);
const sourceName = args[args.indexOf("--database") + 1];
const sourceUri = process.env.MIGRATION_MONGO_URI || process.env.MONGO_URI;
const targetUri = process.env.TEST_MONGO_URI;
const cloneName = `placement_portal_rehearsal_${randomUUID().replaceAll("-", "")}`;
const names = ["admins", "students", "approvedstudents", "authsessions", "companies", "applications", "drives", "jobroles", "resumeversions", "auditlogs", "rosterimports"];
let source, clone;
try {
  const configuredName = sourceUri?.match(/^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]+)/)?.[1];
  if (!args.includes("--database") || !sourceName || decodeURIComponent(configuredName || "") !== sourceName) throw new Error("Specify the exact source database using --database");
  const target = new URL(targetUri);
  if (target.protocol !== "mongodb:" || !["127.0.0.1", "localhost", "[::1]"].includes(target.hostname) || target.username || target.password) throw new Error("TEST_MONGO_URI must be an unauthenticated localhost replica set");
  source = new mongoose.mongo.MongoClient(sourceUri, { serverSelectionTimeoutMS: 10000 });
  await source.connect();
  const sourceDb = source.db(sourceName), original = {}, indexes = {};
  const sourceSession = source.startSession();
  try {
    await sourceSession.withTransaction(async () => {
      for (const name of names) original[name] = await sourceDb.collection(name).find({}, { session: sourceSession }).sort({ _id: 1 }).toArray();
    }, { readConcern: { level: "snapshot" }, readPreference: "primary" });
    for (const name of names) {
      try { indexes[name] = await sourceDb.collection(name).listIndexes().toArray(); }
      catch (error) { if (error.code !== 26) throw error; indexes[name] = []; }
    }
  } finally { await sourceSession.endSession(); }
  await source.close(); source = null;
  await mongoose.connect(targetUri, { dbName: cloneName, autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000 });
  clone = mongoose.connection.db;
  for (const name of names) {
    if (original[name].length) await clone.collection(name).insertMany(original[name]);
    for (const index of indexes[name].filter(index => index.name !== "_id_")) {
      const options = Object.fromEntries(["name", "unique", "sparse", "partialFilterExpression", "expireAfterSeconds", "collation"].filter(key => index[key] !== undefined).map(key => [key, index[key]]));
      // TTL expiry must not race the exact-copy rollback comparison in the clone.
      delete options.expireAfterSeconds;
      await clone.collection(name).createIndex(index.key, options);
    }
  }
  // Drop cloned TTL indexes so the migration can install the correct definition.
  for (const name of names) for (const index of indexes[name].filter(index => index.expireAfterSeconds !== undefined)) await clone.collection(name).dropIndex(index.name);
  const preview = await planStage2(clone);
  assert.deepEqual(preview.conflicts, [], "Resolve the dry-run conflicts before rehearsal");
  const applied = await applyStage2(mongoose.connection);
  const applications = await clone.collection("applications").find().toArray();
  for (const application of applications) {
    assert.ok(await clone.collection("students").findOne({ _id: application.student }));
    assert.ok(await clone.collection("companies").findOne({ _id: application.company }));
    assert.ok(await clone.collection("drives").findOne({ _id: application.drive }));
    assert.ok(await clone.collection("jobroles").findOne({ _id: application.role, drive: application.drive }));
  }
  assert.equal((await applyStage2(mongoose.connection)).alreadyApplied, true);
  await rollbackStage2(mongoose.connection);
  for (const name of names) {
    const restored = await clone.collection(name).find().sort({ _id: 1 }).toArray();
    if (!isDeepStrictEqual(restored, original[name])) throw new Error(`${name} rollback mismatch; records omitted from output`);
  }
  console.log(JSON.stringify({ sourceDatabase: sourceName, sourceAccess: "read-only", isolatedCopy: true, summary: applied.summary, warnings: preview.warnings, referenceChecks: "passed", repeatedApply: "passed", exactRecordRollback: "passed" }, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally {
  if (clone && mongoose.connection.name === cloneName && cloneName.startsWith("placement_portal_rehearsal_")) await clone.dropDatabase();
  await mongoose.disconnect(); await source?.close();
}
