import { z } from "zod";
import { emailSchema, inputNumber } from "./fieldValidators.js";
import { normalizeBranch, validBranch } from "../config/academicPrograms.js";

const singleLine = max => z.string().trim().max(max).refine(value => !/[\r\n\u0000]/.test(value), "Use a single line for each field");
export const rosterFields = {
  name: singleLine(200).optional(), enrollmentNo: singleLine(100).optional(),
  branch: singleLine(100).transform(normalizeBranch).refine(value => !value || validBranch(value), "Choose a listed branch").optional(),
  passingYear: inputNumber(z.number().int().min(2000).max(2100)).optional(),
};
export const rosterRecordSchema = z.object({ email: emailSchema, ...rosterFields }).strict();
