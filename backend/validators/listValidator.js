import { z } from "zod";
import { objectId } from "./authValidator.js";
const text = z.string().trim().max(100).default("");
const integer = (fallback, max) => z.coerce.number().int().min(1).max(max).default(fallback);
export const paging = { page: integer(1, 10000), limit: integer(20, 50) };
export const applicationListSchema = z.object({ ...paging, search: text, roleId: objectId.optional(),
  status: z.enum(["ALL", "APPLIED", "SHORTLISTED", "INTERVIEW", "SELECTED", "OFFERED", "PLACED", "REJECTED", "WITHDRAWN"]).default("ALL"),
  stage: text, sort: z.enum(["latest", "oldest", "high", "low", "name"]).default("latest"),
  requests: z.enum(["", "ANY", "PENDING", "APPROVED", "REJECTED"]).default(""), applicationId: objectId.optional(),
}).strict();
export const companyListSchema = z.object({ ...paging, search: text, branch: text, course: text, role: text,
  cgpa: z.enum(["", "6-7", "7-8", "8+"]).default(""), status: z.enum(["", "PUBLISHED", "CLOSED", "DRAFT"]).default(""),
  sort: z.enum(["latest", "a-z", "deadline"]).default("latest"),
  saved: z.enum(["", "true"]).default(""), applied: z.enum(["", "true", "false"]).default(""),
  eligibility: z.enum(["", "true", "false"]).default(""),
}).strict();
export const reportSchema = z.object({ ...paging, search: text, course: text, branch: text,
  passingYear: z.union([z.literal(""), z.coerce.number().int().min(1950).max(2200)]).default(""),
  placement: z.enum(["", "PLACED", "NOT_PLACED"]).default(""),
  group: z.enum(["branch", "year", "company"]).default("branch"),
}).strict();
export const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const pageMeta = (total, query) => ({ total, limit: query.limit, page: query.page, pages: Math.max(1, Math.ceil(total / query.limit)) });
