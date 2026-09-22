import Student from "../models/Student.js";
import Application from "../models/Application.js";
import Company from "../models/Company.js";
import JobRole from "../models/JobRole.js";
import SavedOpportunity from "../models/SavedOpportunity.js";
// Add indexes only. Existing records, permissions, policies and indexes are preserved.
export async function setupStage6(connection, { apply = false } = {}) {
  const models = [Student, Application, Company, JobRole, SavedOpportunity];
  if (apply) for (const model of models) await model.createIndexes();
  return { database: connection.name, mode: apply ? "apply" : "dry-run", indexes: models.map(model => ({ collection: model.collection.name, definitions: model.schema.indexes() })) };
}
