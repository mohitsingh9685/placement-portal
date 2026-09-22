import Application from "../models/Application.js";
import mongoose from "mongoose";
import { applicationListSchema, escapeRegex, pageMeta } from "../validators/listValidator.js";

// Filtering and sorting use the same accepted snapshot shown in the applicant card/export.
export const effectiveSnapshotExpression = { $ifNull: [{ $getField: { field: "proposedSnapshot", input: { $arrayElemAt: [{ $filter: { input: { $ifNull: ["$requests", []] }, as: "r", cond: { $and: [{ $eq: ["$$r.kind", "CORRECTION"] }, { $eq: ["$$r.status", "APPROVED"] }] } } }, -1] } } }, "$snapshot"] };
const lookup = (from, field, projection) => [{ $lookup: { from, localField: field, foreignField: "_id", pipeline: [{ $project: projection }], as: field } }, { $unwind: { path: `$${field}`, preserveNullAndEmptyArrays: true } }];
export async function listApplications(base, rawQuery) {
  const query = applicationListSchema.parse(rawQuery);
  const filter = {};
  if (query.roleId) base = { ...base, role: new mongoose.Types.ObjectId(query.roleId) };
  if (query.status !== "ALL") filter.status = query.status;
  if (query.stage) filter.currentStageKey = query.stage;
  if (query.applicationId) filter._id = new mongoose.Types.ObjectId(query.applicationId);
  if (query.requests) filter.requests = query.requests === "ANY" ? { $exists: true, $not: { $size: 0 } } : { $elemMatch: { status: query.requests } };
  if (query.search) filter.$or = ["effectiveSnapshot.name", "effectiveSnapshot.email", "effectiveSnapshot.enrollmentNo", "effectiveSnapshot.roleTitle", "company.companyName"].map(key => ({ [key]: { $regex: escapeRegex(query.search), $options: "i" } }));
  const order = { latest: { appliedAt: -1, _id: -1 }, oldest: { appliedAt: 1, _id: 1 }, name: { "effectiveSnapshot.name": 1, _id: 1 }, high: { cgpaMissing: 1, "effectiveSnapshot.cgpa": -1, _id: 1 }, low: { cgpaMissing: 1, "effectiveSnapshot.cgpa": 1, _id: 1 } }[query.sort];
  const matching = [
    { $addFields: { effectiveSnapshot: effectiveSnapshotExpression, currentStageKey: { $ifNull: ["$currentStageKey", "applied"] } } },
    ...lookup("companies", "company", { companyName: 1, role: 1, compensation: 1, ctc: 1 }),
    { $match: filter },
  ];
  const [result] = await Application.aggregate([
    { $match: base },
    { $facet: {
      counts: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
      requestCount: [{ $match: { requests: { $elemMatch: { status: "PENDING" } } } }, { $count: "count" }],
      total: [...matching, { $count: "count" }],
      items: [...matching,
        { $addFields: { cgpaMissing: { $cond: [{ $isNumber: "$effectiveSnapshot.cgpa" }, 0, 1] } } },
        { $sort: order }, { $skip: (query.page - 1) * query.limit }, { $limit: query.limit },
        ...lookup("students", "student", { name: 1, email: 1 }), ...lookup("jobroles", "role", { title: 1 }),
        { $unset: ["cgpaMissing", "__v"] },
      ],
    } },
  ]);
  const counts = Object.fromEntries(result.counts.map(row => [row._id, row.count]));
  const totalApplications = Object.values(counts).reduce((sum, count) => sum + count, 0);
  return { applications: result.items, counts, totalApplications, requestCount: result.requestCount[0]?.count || 0, ...pageMeta(result.total[0]?.count || 0, query) };
}
