import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),

  enrollmentNo: z.string().min(1, "Enrollment No is required"),
  collegeName: z.string().min(1, "College Name is required"),
  course: z.string().min(1, "Course is required"),
  branch: z.string().min(1, "Branch is required"),

  semester: z.coerce.number(),
  passingYear: z.coerce.number(),
  cgpa: z.coerce.number(),

  counselorGroup: z.string().min(1, "Counselor Group is required"),
  contactNo: z.string().min(10, "Contact No is required"),
  whatsappNo: z.string().min(10, "Whatsapp No is required"),

  totalBacklogs: z.coerce.number(),
  activeBacklogs: z.coerce.number(),
}).passthrough();

export const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});
