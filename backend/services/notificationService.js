import { createHash } from "node:crypto";
import mongoose from "mongoose";
import Notification from "../models/Notification.js";
import NotificationRead from "../models/NotificationRead.js";
import SavedOpportunity from "../models/SavedOpportunity.js";
import JobRole from "../models/JobRole.js";
import Drive from "../models/Drive.js";
import Company from "../models/Company.js";
import Application from "../models/Application.js";
import ApiError from "../utils/ApiError.js";

export async function notify({ key, ...fields }, session = null) {
  const _id = createHash("sha256").update(key).digest("hex");
  try { await Notification.updateOne({ _id }, { $setOnInsert: { ...fields, createdAt: new Date() } }, { upsert: true, session }); }
  catch (error) { if (session || error.code !== 11000) throw error; }
  return _id;
}

const audience = (student, now = new Date()) => ({
  $and: [
    { $or: [{ recipient: student._id }, { recipient: null, createdAt: { $gte: student.createdAt || new Date(0) } }] },
    { $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] },
  ],
});

// Reminders are prepared when a student opens/polls the portal, with no worker or email service.
export async function syncDeadlineReminders(student, now = new Date()) {
  const saved = await SavedOpportunity.find({ student: student._id, remind: true }).select("company").lean();
  const drives = await Drive.find({ company: { $in: saved.map(s => s.company) }, status: "PUBLISHED", registrationDeadline: { $gt: now, $lte: new Date(now.getTime() + 86400000) } }).select("company title registrationDeadline").lean();
  const applied = new Set((await Application.distinct("drive", { student: student._id, drive: { $in: drives.map(d => d._id) } })).map(String));
  const open = new Set((await JobRole.distinct("drive", { drive: { $in: drives.map(d => d._id) }, isActive: true, finalizedStages: { $ne: "applied" } })).map(String));
  const due = drives.filter(d => open.has(String(d._id)) && !applied.has(String(d._id)));
  // Suppress outdated reminders when a drive closes, its deadline changes, or the student applies.
  await Notification.deleteMany({ recipient: student._id, kind: "DEADLINE", company: { $nin: due.map(d => d.company) } });
  const companies = new Map((await Company.find({ _id: { $in: due.map(d => d.company) } }).select("companyName").lean()).map(c => [String(c._id), c]));
  for (const drive of due) {
    await Notification.deleteMany({ recipient: student._id, kind: "DEADLINE", company: drive.company, expiresAt: { $ne: drive.registrationDeadline } });
    await notify({ key: `deadline:${student._id}:${drive._id}:${drive.registrationDeadline.toISOString()}`, recipient: student._id, kind: "DEADLINE", company: drive.company, title: "Application deadline approaching", message: `${companies.get(String(drive.company))?.companyName || drive.title}: your saved drive closes within 24 hours.`, expiresAt: drive.registrationDeadline });
  }
}

export async function inbox(student, { page = 1, limit = 20, kind = "ALL", read = "ALL" } = {}, now = new Date()) {
  await syncDeadlineReminders(student, now);
  const asOf = new Date();
  const selected = { ...(kind === "ALL" ? {} : { kind }), ...(read === "ALL" ? {} : { read: read === "READ" }) };
  const [result] = await Notification.aggregate([
    { $match: { ...audience(student, now), createdAt: { $lte: asOf } } },
    { $lookup: { from: "notificationreads", let: { receipt: { $concat: [String(student._id), ":", "$_id"] } }, pipeline: [{ $match: { $expr: { $eq: ["$_id", "$$receipt"] } } }], as: "receipts" } },
    { $addFields: { read: { $gt: [{ $size: "$receipts" }, 0] } } },
    { $project: { receipts: 0, recipient: 0 } },
    { $facet: {
      items: [{ $match: selected }, { $sort: { createdAt: -1, _id: -1 } }, { $skip: (page - 1) * limit }, { $limit: limit }],
      total: [{ $match: selected }, { $count: "count" }],
      counts: [{ $group: { _id: "$kind", total: { $sum: 1 }, unread: { $sum: { $cond: ["$read", 0, 1] } } } }],
    } },
  ]);
  const total = result.total[0]?.count || 0;
  const counts = Object.fromEntries(result.counts.map(({ _id, total, unread }) => [_id, { total, unread }]));
  const totalCount = result.counts.reduce((sum, entry) => sum + entry.total, 0);
  const unreadCount = result.counts.reduce((sum, entry) => sum + entry.unread, 0);
  return { items: result.items, total, totalCount, unreadCount, counts, page, limit, pages: Math.max(1, Math.ceil(total / limit)), asOf: asOf.toISOString() };
}

export async function markNotificationsRead(student, { id, before }) {
  const filter = { ...audience(student), ...(id ? { _id: id } : { createdAt: { $lte: new Date(before) } }) };
  const notifications = await Notification.find(filter).select("_id").lean();
  if (id && !notifications.length) throw new ApiError(404, "Notification not found");
  if (!notifications.length) return;
  // Deterministic receipt IDs keep repeated/concurrent reads idempotent.
  const operations = notifications.map(n => ({ updateOne: { filter: { _id: `${student._id}:${n._id}` }, update: { $setOnInsert: { student: new mongoose.Types.ObjectId(student._id), notification: n._id, readAt: new Date() } }, upsert: true } }));
  try { await NotificationRead.bulkWrite(operations, { ordered: false }); }
  catch (error) { if (error.code !== 11000 || error.writeErrors?.some(e => e.code !== 11000)) throw error; }
}
