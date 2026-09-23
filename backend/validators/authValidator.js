import { z } from "zod";
import { normalizeCourse, normalizeBranch, validBranch, validProgram } from "../config/academicPrograms.js";
import { inputNumber as number, cgpaSchema, cgpaCutoffSchema, phoneSchema, percentageSchema } from "./fieldValidators.js";
const webUrl = z.string().trim().max(2000).pipe(z.union([z.literal(""), z.url({ protocol: /^https?$/ })]));
const text = z.string().trim().max(200);
export const googleAuthSchema = z.object({ token: z.string().trim().min(1, "Google token is required").max(20000) });
export const profileUpdateSchema = z.preprocess((body) => {
  if (!body || typeof body !== "object") return body;
  return { ...body, activeBacklogs: body.activeBacklogs ?? body.activebacklogs };
}, z.object({
  name: text.min(1, "Full name is required").optional(),
  cgpa: number(cgpaSchema),
  branch: text.min(1, "Branch is required").transform(normalizeBranch).refine(validBranch, "Choose a listed branch"),
  activeBacklogs: number(z.number().int().min(0).max(100)),
  totalBacklogs: number(z.number().int().min(0).max(100)),
  enrollmentNo: text.min(1, "Enrollment number is required").optional(), collegeName: text.min(1, "College name is required").optional(), course: text.min(1, "Choose a course").transform(normalizeCourse).optional(),
  semester: number(z.number().int().min(1).max(12)).optional(),
  passingYear: number(z.number().int().min(2000).max(2100)).optional(),
  tenthPercentage: number(percentageSchema.nullable()).optional(),
  entryQualification: z.enum(["TWELFTH", "DIPLOMA"]).optional(),
  diplomaPercentage: number(percentageSchema.nullable()).optional(),
  diplomaBranch: text.transform(normalizeBranch).refine(branch => !branch || validProgram("B.Tech", branch), "Choose a listed diploma branch").optional(), diplomaCollege: text.optional(),
  diplomaPassingYear: number(z.number().int().min(1980).max(2100).nullable()).optional(),
  twelfthPercentage: number(percentageSchema.nullable()).optional(), twelfthStream: text.optional(),
  githubUrl: webUrl.optional(),
  linkedinUrl: webUrl.optional(),
  portfolioLinks: z.array(z.object({ label: z.string().trim().min(1, "Name each portfolio link").max(60), url: z.string().trim().max(2000).pipe(z.url({ protocol: /^https?$/ })) })).max(10).optional(),
  semesterCgpa: z.array(z.object({ sem: number(z.number().int().min(1).max(12)), cgpa: number(cgpaSchema) })).max(12).refine(rows => new Set(rows.map(row => row.sem)).size === rows.length, "Semester entries must be unique").optional(),
  projects: z.array(z.object({ title: text.min(1), description: z.string().trim().max(3000).optional(), projectUrl: webUrl.optional() })).max(20).optional(),
  counselorGroup: text.optional(), contactNo: phoneSchema.optional(), whatsappNo: z.union([z.literal(""), phoneSchema]).optional(),
  skills: z.array(z.string().trim().min(1).max(100)).max(100).optional(),
}).refine(data => !data.course || validProgram(data.course, data.branch), { message: "Choose a valid course and branch combination", path: ["branch"] }).refine((data) => data.activeBacklogs <= data.totalBacklogs, {
  message: "Active backlogs cannot exceed total backlogs", path: ["activeBacklogs"],
}));
// Initial completion must not be bypassed with an academic-only request.
export const profileCompletionSchema = z.object({
  name: text.min(1, "Full name is required"), enrollmentNo: text.min(1, "Enrollment number is required"),
  collegeName: text.min(1, "College name is required"), course: text.min(1, "Choose a course"),
  semester: z.number().int().min(1).max(12), passingYear: z.number().int().min(2000).max(2100),
  contactNo: phoneSchema,
});
export const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid record ID");
export const applySchema = z.object({ companyId: objectId.optional(), roleId: objectId.optional(), profileVersion: z.number().int().min(0).optional(), driveRevision: z.number().int().min(0).optional() }).strict().refine(data => Boolean(data.companyId) !== Boolean(data.roleId), "Provide one company or role ID");
export const applicationRequestSchema = z.object({ kind: z.enum(["WITHDRAWAL", "CORRECTION"]), reason: z.string().trim().min(5).max(1000) }).strict();
export const applicationRequestDecisionSchema = z.object({ decision: z.enum(["APPROVED", "REJECTED"]), response: z.string().trim().min(3, "Write at least 3 characters in your response, for example: Done.").max(1000, "Keep your response within 1,000 characters.") }).strict();
export const statusSchema = z.object({
  status: z.string().trim().toUpperCase().pipe(z.enum(["APPLIED", "SELECTED", "REJECTED"])),
});
const companyFields = z.object({
  companyName: text.min(1), role: text.min(1), description: z.string().trim().min(1).max(20000),
  compensation: z.object({ amount: number(z.number().min(0)), currency: z.literal("INR"), kind: z.enum(["SALARY", "STIPEND", "UNSPECIFIED"]), period: z.enum(["ANNUAL", "MONTHLY", "UNSPECIFIED"]) }).optional(),
  ctc: number(z.number().min(0)), minCgpa: number(cgpaCutoffSchema),
  maxBacklogsAllowed: number(z.number().int().min(0).max(100)), allowActiveBacklogs: z.boolean().optional(),
  allowedBranches: z.preprocess((value) => typeof value === "string" ? value.split(",") : value,
    z.array(text.transform(normalizeBranch).refine(value => !value || validBranch(value), "Choose a listed branch")).transform((values) => [...new Set(values.filter(Boolean))])
      .refine((values) => values.length > 0, "At least one branch is required")),
  registrationDeadline: z.string().datetime({ offset: true }).optional(),
});
const consistentCompensation = (data) => !data.compensation || data.ctc === undefined || data.ctc === data.compensation.amount;
export const createCompanySchema = companyFields.refine(consistentCompensation, "CTC and compensation amount must match");
export const updateCompanySchema = companyFields.partial()
  .refine((data) => Object.keys(data).length > 0, "No valid company fields supplied")
  .refine(consistentCompensation, "CTC and compensation amount must match");
