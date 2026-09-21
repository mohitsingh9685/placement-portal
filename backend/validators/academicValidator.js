import { z } from "zod";
import { academicPrograms, normalizeCourse, normalizeBranch, validProgram } from "../config/academicPrograms.js";
export const programCriteriaSchema = z.array(z.object({
  course: z.string().trim().max(200).transform(normalizeCourse).refine(course => academicPrograms.some(p => p.course === course), "Choose a supported course"),
  allBranches: z.boolean().default(false),
  branches: z.array(z.string().trim().min(1).max(200).transform(normalizeBranch)).max(100).transform(values => [...new Set(values)]),
}).strict().superRefine((p, ctx) => {
  if (!p.allBranches && !p.branches.length) ctx.addIssue({ code: "custom", message: "Choose branches or All branches for each course" });
  if (p.branches.some(b => !validProgram(p.course, b))) ctx.addIssue({ code: "custom", message: "A selected branch does not belong to its course" });
})).max(academicPrograms.length).refine(programs => new Set(programs.map(p => p.course)).size === programs.length, "A course cannot be repeated");
export function branchSummary(criteria) {
  if (criteria.allCourses) return [...new Set(academicPrograms.flatMap(p => p.branches))];
  if (criteria.programs.length) return [...new Set(criteria.programs.flatMap(p => p.allBranches ? academicPrograms.find(item => item.course === p.course).branches : p.branches))];
  return criteria.allowedBranches;
}
