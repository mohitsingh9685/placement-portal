import { z } from "zod";
import { objectId } from "./authValidator.js";
export const exportColumns = ["name", "email", "enrollmentNo", "course", "branch", "passingYear", "cgpa", "tenthPercentage", "twelfthPercentage", "diplomaPercentage", "activeBacklogs", "totalBacklogs", "contactNo", "company", "role", "round", "status"];
export const exportSchema = z.object({ roleId: objectId.optional(), stageKey: z.string().max(80).optional(), format: z.enum(["xlsx", "csv"]).default("xlsx"), columns: z.array(z.enum(exportColumns)).min(1).max(exportColumns.length).refine(v => new Set(v).size === v.length, "Choose each column once") }).strict();
export const resultSchema = z.object({
  roleId: objectId, sourceKey: z.string().regex(/^[\w-]{1,80}$/), mode: z.enum(["PARTIAL", "FINAL"]),
  text: z.string().max(250000).default(""), confirmEmptyShortlist: z.boolean().default(false),
  reason: z.string().trim().min(3).max(1000),
}).strict();
export const undoSchema = z.object({ reason: z.string().trim().min(5).max(1000) }).strict();
export const offerSchema = z.object({ revision: z.number().int().min(0), action: z.enum(["ISSUE", "ACCEPT", "JOIN", "DECLINE", "REVOKE"]),
  reason: z.string().trim().min(3).max(1000), compensationDetails: z.string().trim().max(2000).default(""), reference: z.string().trim().max(500).default("")
}).strict().refine(v => v.action !== "ISSUE" || v.compensationDetails.length > 0, "Enter the offer's compensation details");
export const policySchema = z.object({ revision: z.number().int().min(0), placedOn: z.enum(["ACCEPTED", "JOINED"]), furtherApplications: z.enum(["ALLOW", "BLOCK", "DREAM_ONLY"]) }).strict();
