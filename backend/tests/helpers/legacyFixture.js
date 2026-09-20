import mongoose from "mongoose";
export async function seedLegacyFixture(db) {
  const [studentId, adminId, companyId, applicationId] = [11,12,13,14].map(n => new mongoose.Types.ObjectId(`507f1f77bcf86cd7994390${n}`));
  const student = { _id: studentId, name: "Synthetic Student", email: "student@example.invalid", googleId: "student-google", role: "student", profileCompleted: true, cgpa: 8.2, branch: "CSE", activeBacklogs: 0, totalBacklogs: 0, semester: 6, passingYear: 2027, enrollmentNo: "TEST001", placementStatus: "NOT_PLACED", resume: { key: "synthetic/old.pdf", url: "https://example.invalid/old.pdf", fileName: "old.pdf", uploadedAt: new Date("2026-01-01") }, createdAt: new Date("2025-01-01"), updatedAt: new Date("2026-01-01") };
  const admin = { _id: adminId, name: "Synthetic Admin", email: "admin@example.invalid", googleId: "admin-google", role: "admin", profileCompleted: true, profilePicture: { url: "https://example.invalid/admin.png", publicId: "" }, refreshToken: "retired-hash", createdAt: new Date("2025-01-01") };
  const company = { _id: companyId, companyName: "Example Company", role: "Engineer", description: "Synthetic recruitment", ctc: 1200000, minCgpa: 7, maxBacklogsAllowed: 0, allowedBranches: ["CSE"], createdBy: adminId, totalApplicants: 0, registrationDeadline: new Date(Date.now() + 86400000) };
  const application = { _id: applicationId, student: studentId, company: companyId, status: "SELECTED", isEligible: false, snapshot: { name: "Earlier Name", email: student.email, cgpa: 7.5, branch: "CSE" }, appliedAt: new Date("2026-01-02") };
  await db.collection("students").insertMany([student, admin]);
  await db.collection("approvedstudents").insertMany([{ email: student.email, role: "student", branch: "CSE", passingYear: 2027, isActive: true }, { email: admin.email, role: "admin", isActive: true }]);
  await db.collection("companies").insertOne(company);
  await db.collection("applications").createIndex({ student: 1, company: 1 }, { unique: true });
  await db.collection("applications").insertOne(application);
  await db.collection("authsessions").insertOne({ _id: "legacy-admin-session", user: adminId, tokenHash: "hash", expiresAt: new Date(Date.now() + 86400000) });
  return { student, admin, company, application, studentId, adminId, companyId, applicationId };
}
