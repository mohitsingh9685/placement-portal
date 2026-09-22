import Student from "../models/Student.js";
import Application from "../models/Application.js";
import Company from "../models/Company.js";
import { reportSchema, escapeRegex, pageMeta } from "../validators/listValidator.js";
import { validBranch } from "../config/academicPrograms.js";

export const offerStates = ["ISSUED", "ACCEPTED", "JOINED", "DECLINED", "REVOKED"];
export const activeOffers = ["ISSUED", "ACCEPTED", "JOINED"];
const sumIf = condition => ({ $sum: { $cond: [condition, 1, 0] } });
const placed = { $eq: ["$placementStatus", "PLACED"] };
const offer = { $in: ["$offer.status", offerStates] };
const active = { $in: ["$offer.status", activeOffers] };
function studentFilter(query) {
  const filter = { role: "student" };
  if (query.course) filter.course = query.course;
  if (query.branch) filter.branch = query.branch;
  if (query.passingYear) filter.passingYear = query.passingYear;
  return filter;
}
function cohortApplications(query) {
  return [{ $lookup: { from: "students", localField: "student", foreignField: "_id", pipeline: [{ $match: studentFilter(query) }, { $project: { _id: 1 } }], as: "cohortStudent" } }, { $match: { "cohortStudent.0": { $exists: true } } }, { $unset: "cohortStudent" }];
}
const overviewGroup = { _id: null, students: { $sum: 1 }, placed: sumIf(placed), incompleteProfiles: sumIf({ $ne: ["$profileCompleted", true] }) };
const formatGroup = row => ({ ...row, unplaced: row.students - row.placed, placementRate: row.students ? Math.round(row.placed / row.students * 1000) / 10 : 0 });
export async function reportOverview(rawQuery) {
  const query = reportSchema.parse(rawQuery);
  const [students, offers] = await Promise.all([
    Student.aggregate([{ $match: studentFilter(query) }, { $group: overviewGroup }]),
    Application.aggregate([...cohortApplications(query), { $group: { _id: null, applications: { $sum: 1 }, recordedOffers: sumIf(offer), activeOffers: sumIf(active),
      ...Object.fromEntries(offerStates.map(status => [status.toLowerCase(), sumIf({ $eq: ["$offer.status", status] })])),
    } }]),
  ]);
  return { ...formatGroup(students[0] || { students: 0, placed: 0, incompleteProfiles: 0 }), ...(offers[0] || { applications: 0, recordedOffers: 0, activeOffers: 0, issued: 0, accepted: 0, joined: 0, declined: 0, revoked: 0 }), asOf: new Date() };
}
export async function reportOptions() {
  const [result] = await Student.aggregate([{ $match: { role: "student" } }, { $group: { _id: null, courses: { $addToSet: "$course" }, branches: { $addToSet: "$branch" }, years: { $addToSet: "$passingYear" } } }]);
  return { courses: (result?.courses || []).filter(Boolean).sort(), branches: (result?.branches || []).filter(branch => branch && validBranch(branch)).sort(), years: (result?.years || []).filter(Number.isFinite).sort((a, b) => b - a) };
}
export async function reportStudents(rawQuery) {
  const query = reportSchema.parse(rawQuery), filter = studentFilter(query);
  if (query.placement) filter.placementStatus = query.placement === "PLACED" ? "PLACED" : { $ne: "PLACED" };
  if (query.search) filter.$or = ["name", "email", "enrollmentNo"].map(key => ({ [key]: { $regex: escapeRegex(query.search), $options: "i" } }));
  const [result] = await Student.aggregate([{ $match: filter }, { $facet: {
    total: [{ $count: "count" }], items: [{ $sort: { name: 1, _id: 1 } }, { $skip: (query.page - 1) * query.limit }, { $limit: query.limit },
      { $project: { name: 1, email: 1, enrollmentNo: 1, course: 1, branch: 1, passingYear: 1, placementStatus: 1, profileCompleted: 1 } },
      { $lookup: { from: "applications", localField: "_id", foreignField: "student", pipeline: [{ $match: { "offer.status": { $in: activeOffers } } }, { $count: "count" }], as: "offers" } },
      { $set: { activeOffers: { $ifNull: [{ $arrayElemAt: ["$offers.count", 0] }, 0] } } }, { $unset: "offers" },
    ],
  } }]);
  return { students: result.items, ...pageMeta(result.total[0]?.count || 0, query) };
}
export async function reportGroups(rawQuery) {
  const query = reportSchema.parse(rawQuery);
  let pipeline, model;
  if (query.group === "company") {
    model = Company;
    pipeline = [
      ...(query.search ? [{ $match: { companyName: { $regex: escapeRegex(query.search), $options: "i" } } }] : []),
      { $lookup: { from: "applications", localField: "_id", foreignField: "company", pipeline: [...cohortApplications(query),
        { $group: { _id: "$student", applications: { $sum: 1 }, recordedOffers: sumIf(offer), activeOffers: sumIf(active), placed: { $max: { $cond: [{ $eq: ["$status", "PLACED"] }, 1, 0] } } } },
        { $group: { _id: null, applicants: { $sum: 1 }, applications: { $sum: "$applications" }, recordedOffers: { $sum: "$recordedOffers" }, activeOffers: { $sum: "$activeOffers" }, placed: { $sum: "$placed" } } },
      ], as: "stats" } },
      { $project: { companyName: 1, ...Object.fromEntries(["applicants", "applications", "recordedOffers", "activeOffers", "placed"].map(key => [key, { $ifNull: [{ $arrayElemAt: [`$stats.${key}`, 0] }, 0] }])) } },
      { $sort: { companyName: 1, _id: 1 } },
    ];
  } else {
    model = Student;
    const present = field => ({ $cond: [{ $in: [{ $ifNull: [field, ""] }, [""]] }, "Not supplied", field] });
    const id = query.group === "year" ? { year: { $ifNull: ["$passingYear", null] } } : { course: present("$course"), branch: present("$branch") };
    pipeline = [{ $match: studentFilter(query) },
      { $lookup: { from: "applications", localField: "_id", foreignField: "student", pipeline: [{ $match: { "offer.status": { $in: offerStates } } }, { $group: { _id: null, recordedOffers: { $sum: 1 }, activeOffers: sumIf(active) } }], as: "offers" } },
      { $group: { ...overviewGroup, _id: id, recordedOffers: { $sum: { $ifNull: [{ $arrayElemAt: ["$offers.recordedOffers", 0] }, 0] } }, activeOffers: { $sum: { $ifNull: [{ $arrayElemAt: ["$offers.activeOffers", 0] }, 0] } } } }, { $sort: query.group === "year" ? { "_id.year": -1 } : { "_id.course": 1, "_id.branch": 1 } }];
  }
  // Company counts need no application lookup; calculate statistics only for this page.
  let detail = [];
  if (query.group === "company") {
    detail = pipeline.filter(stage => stage.$lookup || stage.$project);
    pipeline = pipeline.filter(stage => !stage.$lookup && !stage.$project);
  }
  const [result] = await model.aggregate([...pipeline, { $facet: { total: [{ $count: "count" }], items: [{ $skip: (query.page - 1) * query.limit }, { $limit: query.limit }, ...detail] } }]);
  return { groups: query.group === "company" ? result.items : result.items.map(formatGroup), ...pageMeta(result.total[0]?.count || 0, query) };
}
