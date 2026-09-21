import Notification from "../models/Notification.js";
import NotificationRead from "../models/NotificationRead.js";
import SavedOpportunity from "../models/SavedOpportunity.js";

// Additive setup only: no existing accounts, drives or applications are rewritten.
export async function setupStage4(connection, { apply = false } = {}) {
  const models = [Notification, NotificationRead, SavedOpportunity];
  if (apply) {
    for (const model of models) {
      await connection.db.createCollection(model.collection.name).catch(error => { if (error.code !== 48) throw error; });
      await model.createIndexes();
    }
  }
  return { database: connection.name, mode: apply ? "apply" : "dry-run", collections: models.map(model => ({ name: model.collection.name, indexes: model.schema.indexes().map(([fields]) => fields) })) };
}
