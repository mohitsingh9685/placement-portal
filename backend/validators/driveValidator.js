import { z } from "zod";
import { objectId } from "./authValidator.js";
import { programCriteriaSchema, branchSummary } from "./academicValidator.js";
import { normalizeBranch, validBranch } from "../config/academicPrograms.js";
const text = z.string().trim().max(200);
const description = z.string().trim().max(20000).default("");
export const stagesSchema = z.array(z.object({
  key: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/), name: text.min(1),
  kind: z.enum(["APPLICATION", "ASSESSMENT", "INTERVIEW", "OFFER"]),
}).strict()).min(1).max(20).superRefine((stages, ctx) => {
  if (stages[0].key !== "applied" || stages[0].kind !== "APPLICATION" || stages[0].name !== "Applied") ctx.addIssue({ code: "custom", message: "The first round must be Applied" });
  if (new Set(stages.map(stage => stage.key)).size !== stages.length) ctx.addIssue({ code: "custom", message: "Round identifiers must be unique" });
  if (stages.slice(1).some(stage => stage.kind === "APPLICATION")) ctx.addIssue({ code: "custom", message: "Applied can occur only once" });
  if (stages.some((stage, index) => stage.kind === "OFFER" && index !== stages.length - 1)) ctx.addIssue({ code: "custom", message: "An offer round must be last" });
});
const role = z.object({
  _id: objectId.optional(), title: text.min(1, "Each role needs a title"), description,
  location: text.nullish().transform(value => value || ""), domain: z.enum(["TECH", "SALES", "FINANCE", "OPERATIONS", "OTHER"]).default("OTHER"),
  jobType: z.enum(["Internship", "Full-time", "Internship + PPO"]).nullable().default(null),
  experience: text.default(""), positions: z.number().int().min(1).max(100000).nullable().default(null),
  resumeRequired: z.boolean().optional(),
  compensation: z.object({ amount: z.number().min(0).max(1e10).nullable(), currency: z.literal("INR"),
    mode: z.enum(["AMOUNT", "TEXT"]).default("AMOUNT"), description: z.string().trim().max(1000).default(""),
    kind: z.enum(["SALARY", "STIPEND", "UNSPECIFIED"]), period: z.enum(["ANNUAL", "MONTHLY", "UNSPECIFIED"]), }).strict()
    .transform(pay => pay.mode === "TEXT" ? { ...pay, amount: null, period: "UNSPECIFIED" } : { ...pay, description: "" }),
  eligibility: z.object({
    allCourses: z.boolean().default(false), programs: programCriteriaSchema.default([]),
    minCgpa: z.number().min(0).max(10).default(0),
    minTenthPercentage: z.number().min(0).max(100).nullable().optional(), minTwelfthPercentage: z.number().min(0).max(100).nullable().optional(),
    minDiplomaPercentage: z.number().min(0).max(100).nullable().optional(),
    educationRequirement: z.enum(["TWELFTH_OR_DIPLOMA", "TWELFTH_ONLY", "DIPLOMA_ONLY", "UNSPECIFIED"]).optional(),
    maxActiveBacklogs: z.number().int().min(0).max(100).default(0), maxTotalBacklogs: z.number().int().min(0).max(100).nullable().optional(),
    allowActiveBacklogs: z.boolean().nullable().default(false).transform(value => value ?? true),
    allowedBranches: z.array(text.min(1).transform(normalizeBranch)).max(100).transform(values => [...new Set(values)]),
    passingYears: z.array(z.number().int().min(2000).max(2100)).max(20).transform(values => [...new Set(values)]),
  }).strict().refine(value => value.maxTotalBacklogs == null || value.maxTotalBacklogs >= value.maxActiveBacklogs, "Total backlog limit cannot be below the active backlog limit")
    .refine(value => !value.allCourses || value.programs.length === 0, "Select all courses or individual courses")
    .transform(value => ({ ...value, allowedBranches: branchSummary(value) }))
    .refine(value => value.allowedBranches.every(validBranch), "Choose listed branches"),
  stages: z.union([z.array(z.never()).length(0), stagesSchema]).default([]),
  isActive: z.boolean().default(true),
}).strict();
export const driveSchema = z.object({
  dreamOpportunity: z.boolean().default(false),
  companyName: text.min(1, "Company name is required"), title: text.min(1, "Drive title is required"), description,
  registrationDeadline: z.string().datetime({ offset: true }).nullable().default(null),
  driveDate: z.string().datetime({ offset: true }).nullable().default(null),
  stages: stagesSchema, roles: z.array(role).min(1).max(25),
}).strict().refine(value => { const ids = value.roles.filter(role => role._id).map(role => role._id); return new Set(ids).size === ids.length; }, "A role cannot be repeated");
export const updateDriveSchema = driveSchema.safeExtend({ revision: z.number().int().min(0) });
export const driveStatusSchema = z.object({ revision: z.number().int().min(0), status: z.enum(["PUBLISHED", "CLOSED"]) }).strict();
