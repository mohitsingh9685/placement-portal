import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email({ error: "Enter a valid email address, for example name@example.com" }));
export const phoneSchema = z.string().trim().regex(/^[0-9]{10}$/, "Enter exactly 10 digits for the phone number");
export const cgpaSchema = z.number().gt(0, "CGPA must be greater than 0.00").lt(10, "CGPA must be less than 10.00").multipleOf(0.01, "CGPA can have at most two decimal places");
export const percentageSchema = z.number().min(0, "Marks cannot be below 0%").max(100, "Marks cannot exceed 100%").multipleOf(0.01, "Marks can have at most two decimal places");
// An absent cutoff means no minimum; entered cutoffs use the student CGPA range.
export const cgpaCutoffSchema = z.union([z.literal(0), cgpaSchema]);
export const inputNumber = schema => z.preprocess(value => typeof value === "string" && /^\d+(\.\d+)?$/.test(value.trim()) ? Number(value.trim()) : value, schema);
