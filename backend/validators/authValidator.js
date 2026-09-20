import { z } from "zod";
const number = (schema) => z.preprocess((value) =>
  typeof value === "string" && value.trim() !== "" ? Number(value) : value, schema);
const text = z.string().trim().max(200);
export const googleAuthSchema = z.object({ token: z.string().trim().min(1, "Google token is required").max(20000) });
export const profileUpdateSchema = z.preprocess((body) => {
  if (!body || typeof body !== "object") return body;
  return { ...body, activeBacklogs: body.activeBacklogs ?? body.activebacklogs };
}, z.object({
  cgpa: number(z.number().min(0).max(10)),
  branch: text.min(1, "Branch is required").transform((value) => value.toUpperCase()),
  activeBacklogs: number(z.number().int().min(0)),
  totalBacklogs: number(z.number().int().min(0)),
  enrollmentNo: text.optional(), collegeName: text.optional(), course: text.optional(),
  semester: number(z.number().int().min(1).max(12)).optional(),
  passingYear: number(z.number().int().min(2000).max(2100)).optional(),
  counselorGroup: text.optional(), contactNo: text.optional(), whatsappNo: text.optional(),
  skills: z.array(z.string().trim().min(1).max(100)).max(100).optional(),
}).refine((data) => data.activeBacklogs <= data.totalBacklogs, {
  message: "Active backlogs cannot exceed total backlogs", path: ["activeBacklogs"],
}));
export const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid record ID");
export const applySchema = z.object({ companyId: objectId });
export const statusSchema = z.object({
  status: z.string().trim().toUpperCase().pipe(z.enum(["APPLIED", "SELECTED", "REJECTED"])),
});
const companyFields = z.object({
  companyName: text.min(1), role: text.min(1), description: z.string().trim().min(1).max(20000),
  ctc: number(z.number().min(0)), minCgpa: number(z.number().min(0).max(10)),
  maxBacklogsAllowed: number(z.number().int().min(0)), allowActiveBacklogs: z.boolean().optional(),
  allowedBranches: z.preprocess((value) => typeof value === "string" ? value.split(",") : value,
    z.array(text.transform((value) => value.toUpperCase())).transform((values) => [...new Set(values.filter(Boolean))])
      .refine((values) => values.length > 0, "At least one branch is required")),
  registrationDeadline: z.string().datetime({ offset: true }).optional(),
});
export const createCompanySchema = companyFields;
export const updateCompanySchema = companyFields.partial().refine((data) => Object.keys(data).length > 0, "No valid company fields supplied");
