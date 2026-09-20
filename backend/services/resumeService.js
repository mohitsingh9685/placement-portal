import mongoose from "mongoose";
import Student from "../models/Student.js";
import ResumeVersion from "../models/ResumeVersion.js";
import { uploadFileToS3, generateSignedFileUrl, deleteFileFromS3 } from "./s3Service.js";
import ApiError from "../utils/ApiError.js";
export async function saveResumeVersion(studentId, file, storage = { upload: uploadFileToS3, sign: generateSignedFileUrl, remove: deleteFileFromS3 }) {
  const uploaded = await storage.upload(file, `resumes/${studentId}`);
  let resume;
  try {
    const signedUrl = await storage.sign(uploaded.key);
    await mongoose.connection.transaction(async (session) => {
      const student = await Student.findById(studentId).session(session);
      if (!student) throw new ApiError(404, "Student not found");
      const [version] = await ResumeVersion.create([{
        student: studentId, key: uploaded.key, url: uploaded.url,
        fileName: file.originalname, contentType: file.mimetype, uploadedAt: new Date(),
      }], { session });
      resume = { key: version.key, url: version.url, fileName: version.fileName, contentType: version.contentType, uploadedAt: version.uploadedAt, versionId: version._id };
      await Student.updateOne({ _id: studentId }, { $set: { resume } }, { session });
    });
    return { ...resume, signedUrl };
  } catch (error) {
    // A lost commit acknowledgement is not proof the transaction failed. Keep
    // the object if its version exists, or if the database cannot confirm absence.
    try {
      const committed = await ResumeVersion.exists({ key: uploaded.key });
      if (!committed) await storage.remove(uploaded.key);
    } catch { /* An unreferenced upload can be reconciled once storage/DB recover. */ }
    throw error;
  }
}
