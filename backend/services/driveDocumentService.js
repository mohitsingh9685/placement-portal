import mongoose from "mongoose";
import path from "node:path";
import Drive from "../models/Drive.js";
import JobRole from "../models/JobRole.js";
import Application from "../models/Application.js";
import AuditLog from "../models/AuditLog.js";
import ApiError from "../utils/ApiError.js";
import { hasPermission } from "../config/permissions.js";
import { loadPublishing, assertRevision, documentId, publicDocument, syncCompanySummary } from "./publishingService.js";
import { uploadFileToS3, deleteFileFromS3, generateSignedFileUrl } from "./s3Service.js";
import companyCache from "./companyCache.js";

export const documentStorage = { upload: uploadFileToS3, remove: deleteFileFromS3, sign: generateSignedFileUrl };
const types = { ".pdf": "application/pdf", ".doc": "application/msword", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };
export function validateDriveDocument(file) {
  if (!file?.buffer?.length) throw new ApiError(400, "Choose a document to upload");
  if (file.buffer.length > 10 * 1024 * 1024) throw new ApiError(400, "Each document must be 10MB or smaller");
  const extension = path.extname(file.originalname).toLowerCase(), expected = types[extension];
  if (!expected || (file.mimetype !== expected && !(expected === "image/jpeg" && file.mimetype === "image/jpg"))) throw new ApiError(400, "Use a PDF, DOC, DOCX, PNG, JPG or WEBP file with its matching file type");
  const bytes = file.buffer;
  const valid = extension === ".pdf" ? bytes.subarray(0, 5).toString() === "%PDF-"
    : extension === ".doc" ? bytes.subarray(0, 8).equals(Buffer.from("d0cf11e0a1b11ae1", "hex"))
    : extension === ".docx" ? bytes.subarray(0, 2).toString() === "PK" && bytes.includes(Buffer.from("word/document.xml")) && !bytes.includes(Buffer.from("vbaProject.bin"))
    : extension === ".png" ? bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))
    : [".jpg", ".jpeg"].includes(extension) ? bytes.subarray(0, 3).equals(Buffer.from("ffd8ff", "hex"))
    : bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP";
  if (!valid) throw new ApiError(400, "File contents do not match the selected document type");
  return { ...file, mimetype: expected, originalname: path.basename(file.originalname.replaceAll("\\", "/")).replace(/[\r\n\x00-\x1f]/g, "").slice(0, 200) };
}
function targetFor({ drive, roles }, roleId) {
  if (!roleId) return drive;
  const role = roles.find(role => String(role._id) === roleId);
  if (!role) throw new ApiError(404, "Role not found in this drive");
  return role;
}
async function recordChange(graph, target, actor, action, session) {
  if (target !== graph.drive) await target.save({ session });
  graph.drive.revision = (graph.drive.revision || 0) + 1;
  graph.drive.publishingVersion = 3;
  await graph.drive.save({ session });
  await syncCompanySummary(graph.company, graph.drive, graph.roles, session);
  await AuditLog.create([{ actor, actorModel: "Admin", action, target: String(graph.drive._id), details: { role: target === graph.drive ? null : String(target._id), revision: graph.drive.revision } }], { session });
}
export async function saveDriveDocument(companyId, { revision, roleId, replaceId }, file, actor, storage = documentStorage) {
  const validFile = validateDriveDocument(file);
  const before = await loadPublishing(companyId);
  assertRevision(before.drive, revision);
  const initialTarget = targetFor(before, roleId);
  if (replaceId && !initialTarget.attachments.some(doc => documentId(doc) === replaceId)) throw new ApiError(404, "Document to replace was not found in this scope");
  if (!replaceId && initialTarget.attachments.length >= 20) throw new ApiError(400, "Each drive or role can have up to 20 current documents");
  const uploaded = await storage.upload(validFile, `jds/${companyId}/${roleId || "shared"}`);
  let document;
  try {
    await mongoose.connection.transaction(async session => {
      const graph = await loadPublishing(companyId, session); assertRevision(graph.drive, revision);
      const target = targetFor(graph, roleId);
      document = { key: uploaded.key, url: uploaded.url, fileName: validFile.originalname, contentType: validFile.mimetype, uploadedAt: new Date() };
      document.id = documentId(document);
      if (replaceId) {
        const index = target.attachments.findIndex(doc => documentId(doc) === replaceId);
        if (index < 0) throw new ApiError(409, "Document changed during upload. Reload and try again.");
        target.retiredAttachments.push(target.attachments[index].toObject());
        target.attachments.splice(index, 1, document);
      } else target.attachments.push(document);
      await recordChange(graph, target, actor, "DRIVE_DOCUMENT_UPLOADED", session);
    });
  } catch (error) {
    // A lost commit acknowledgement is not proof of failure. Never delete an
    // object that was committed, or when the database cannot confirm absence.
    try {
      const filter = { $or: [{ "attachments.key": uploaded.key }, { "retiredAttachments.key": uploaded.key }] };
      const referenced = await Drive.exists(filter) || await JobRole.exists(filter) || await Application.exists({ "snapshot.documents.key": uploaded.key });
      if (!referenced) await storage.remove(uploaded.key);
    } catch { /* Retain uncertain objects for later reconciliation. */ }
    throw error;
  }
  await companyCache.invalidate(); return publicDocument(document);
}
export async function retireDriveDocument(companyId, { revision, roleId, documentId: id }, actor) {
  await mongoose.connection.transaction(async session => {
    const graph = await loadPublishing(companyId, session); assertRevision(graph.drive, revision);
    const target = targetFor(graph, roleId), index = target.attachments.findIndex(doc => documentId(doc) === id);
    if (index < 0) throw new ApiError(404, "Document not found in this scope");
    target.retiredAttachments.push(target.attachments[index].toObject());
    target.attachments.splice(index, 1);
    await recordChange(graph, target, actor, "DRIVE_DOCUMENT_RETIRED", session);
  });
  await companyCache.invalidate();
}
export async function signDriveDocument(companyId, id, user, storage = documentStorage) {
  const { drive, roles } = await loadPublishing(companyId);
  const publisher = hasPermission(user, "companies.manage");
  if (drive.status === "DRAFT" && !publisher) throw new ApiError(404, "Document not found");
  const current = [...drive.attachments, ...roles.filter(role => role.isActive !== false || publisher).flatMap(role => role.attachments)];
  let document = current.find(doc => doc.key && documentId(doc) === id);
  if (!document) {
    const historical = [...drive.retiredAttachments, ...roles.flatMap(role => [...role.retiredAttachments, ...role.attachments])];
    const candidate = historical.find(doc => doc.key && documentId(doc) === id);
    if (candidate && (publisher || hasPermission(user, "applications.view") || (user?.role === "student" && await Application.exists({ student: user._id, drive: drive._id, "snapshot.documents.key": candidate.key })))) document = candidate;
  }
  if (!document) throw new ApiError(404, "Document not found");
  return storage.sign(document.key, { fileName: document.fileName, contentType: document.contentType });
}
