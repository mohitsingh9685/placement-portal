import RecruiterResult from "../models/RecruiterResult.js";
import PlacementPolicy from "../models/PlacementPolicy.js";
import Application from "../models/Application.js";
export async function setupStage5(connection, { apply = false } = {}) {
  const models = [RecruiterResult, PlacementPolicy];
  if (apply) {
    for (const model of models) {
      await connection.db.createCollection(model.collection.name).catch(error => { if (error.code !== 48) throw error; });
      await model.createIndexes();
    }
    await Application.createIndexes();
    await PlacementPolicy.updateOne({ _id: "college" }, { $setOnInsert: { placedOn: "ACCEPTED", furtherApplications: "ALLOW", revision: 0, activityVersion: 0 } }, { upsert: true });
  }
  return { database: connection.name, mode: apply ? "apply" : "dry-run", collections: models.map(model => model.collection.name), placementDefaults: { placedOn: "ACCEPTED", furtherApplications: "ALLOW" } };
}
