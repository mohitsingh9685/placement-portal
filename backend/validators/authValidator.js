import { z } from "zod";
import { normalizeCourse, normalizeBranch, validProgram } from "../config/academicPrograms.js";
const number = (schema) => z.preprocess((value) =>
  typeof value === "string" && value.trim() !== "" ? Number(value) : value, schema);
const text = z.string().trim().max(200);
export const googleAuthSchema = z.object({ token: z.string().trim().min(1, "Google token is required").max(20000) });
export const profileUpdateSchema = z.preprocess((body) => {
  if (!body || typeof body !== "object") return body;
  return { ...body, activeBacklogs: body.activeBacklogs ?? body.activebacklogs };
}, z.object({
  name: text.min(1, "Full name is required").optional(),
  cgpa: number(z.number().min(0).max(10)),
  branch: text.min(1, "Branch is required").transform(normalizeBranch),
  activeBacklogs: number(z.number().int().min(0)),
  totalBacklogs: number(z.number().int().min(0)),
  enrollmentNo: text.optional(), collegeName: text.optional(), course: text.transform(normalizeCourse).optional(),
  semester: number(z.number().int().min(1).max(12)).optional(),
  passingYear: number(z.number().int().min(2000).max(2100)).optional(),
  tenthPercentage: number(z.number().min(0).max(100).nullable()).optional(),
  entryQualification: z.enum(["TWELFTH", "DIPLOMA"]).optional(),
  diplomaPercentage: number(z.number().min(0).max(100).nullable()).optional(),
  diplomaBranch: text.transform(normalizeBranch).optional(), diplomaCollege: text.optional(),
  diplomaPassingYear: number(z.number().int().min(1980).max(2100).nullable()).optional(),
  twelfthPercentage: number(z.number().min(0).max(100).nullable()).optional(), twelfthStream: text.optional(),
  githubUrl: z.union([z.literal(""), z.url({ protocol: /^https?$/ })]).optional(),
  linkedinUrl: z.union([z.literal(""), z.url({ protocol: /^https?$/ })]).optional(),
  semesterCgpa: z.array(z.object({ sem: number(z.number().int().min(1).max(12)), cgpa: number(z.number().min(0).max(10)) })).max(12).refine(rows => new Set(rows.map(row => row.sem)).size === rows.length, "Semester entries must be unique").optional(),
  projects: z.array(z.object({ title: text.min(1), description: z.string().trim().max(3000).optional(), projectUrl: z.union([z.literal(""), z.url({ protocol: /^https?$/ })]).optional() })).max(20).optional(),
  counselorGroup: text.optional(), contactNo: text.optional(), whatsappNo: text.optional(),
  skills: z.array(z.string().trim().min(1).max(100)).max(100).optional(),
}).refine(data => !data.course || validProgram(data.course, data.branch), { message: "Choose a valid course and branch combination", path: ["branch"] }).refine((data) => data.activeBacklogs <= data.totalBacklogs, {
  message: "Active backlogs cannot exceed total backlogs", path: ["activeBacklogs"],
}));
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
  ctc: number(z.number().min(0)), minCgpa: number(z.number().min(0).max(10)),
  maxBacklogsAllowed: number(z.number().int().min(0)), allowActiveBacklogs: z.boolean().optional(),
  allowedBranches: z.preprocess((value) => typeof value === "string" ? value.split(",") : value,
    z.array(text.transform((value) => value.toUpperCase())).transform((values) => [...new Set(values.filter(Boolean))])
      .refine((values) => values.length > 0, "At least one branch is required")),
  registrationDeadline: z.string().datetime({ offset: true }).optional(),
});
const consistentCompensation = (data) => !data.compensation || data.ctc === undefined || data.ctc === data.compensation.amount;
export const createCompanySchema = companyFields.refine(consistentCompensation, "CTC and compensation amount must match");
export const updateCompanySchema = companyFields.partial()
  .refine((data) => Object.keys(data).length > 0, "No valid company fields supplied")
  .refine(consistentCompensation, "CTC and compensation amount must match");
