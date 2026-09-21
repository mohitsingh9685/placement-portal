import { createPublishing, updatePublishing, changePublishingStatus, getPublishing } from "../services/publishingService.js";
import { saveDriveDocument, retireDriveDocument, signDriveDocument } from "../services/driveDocumentService.js";
import { z } from "zod";
import { objectId } from "../validators/authValidator.js";
const documentOptions = z.object({ revision: z.coerce.number().int().min(0), roleId: objectId.optional(), replaceId: objectId.optional() }).strict();
export async function createDrive(req, res, next) {
  try { const id = await createPublishing(req.body, req.user._id); res.status(201).json(await getPublishing(id, req.user)); } catch (error) { next(error); }
}
export async function editDrive(req, res, next) {
  try { await updatePublishing(req.params.id, req.body, req.user._id); res.json(await getPublishing(req.params.id, req.user)); } catch (error) { next(error); }
}
export async function setDriveStatus(req, res, next) {
  try { await changePublishingStatus(req.params.id, req.body, req.user._id); res.json(await getPublishing(req.params.id, req.user)); } catch (error) { next(error); }
}
export async function uploadDriveDocument(req, res, next) {
  try {
    const options = documentOptions.parse(req.query);
    await saveDriveDocument(req.params.id, options, req.file, req.user._id);
    res.status(201).json(await getPublishing(req.params.id, req.user));
  } catch (error) { next(error); }
}
export async function removeDriveDocument(req, res, next) {
  try {
    const options = documentOptions.omit({ replaceId: true }).parse(req.query);
    await retireDriveDocument(req.params.id, { ...options, documentId: req.params.documentId }, req.user._id);
    res.json(await getPublishing(req.params.id, req.user));
  } catch (error) { next(error); }
}
export async function viewDriveDocument(req, res, next) {
  try { res.json({ signedUrl: await signDriveDocument(req.params.id, req.params.documentId, req.user) }); } catch (error) { next(error); }
}
