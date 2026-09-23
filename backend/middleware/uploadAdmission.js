// Multer buffers files in memory. Keep simultaneous uploads bounded across
// routes, without grouping all students behind the same campus IP address.
export function createUploadAdmission({ maximum = 8, perUser = 2 } = {}) {
  let active = 0;
  const users = new Map();
  return (req, res, next) => {
    if (!req.user?._id) return res.status(401).json({ success: false, message: "Sign in to upload files" });
    const user = String(req.user._id);
    const count = users.get(user) || 0;
    if (active >= maximum || count >= perUser) {
      res.set("Retry-After", "5");
      return res.status(429).json({ success: false, code: "UPLOAD_BUSY", message: "Uploads are busy. Please try again in a few seconds." });
    }
    active += 1;
    users.set(user, count + 1);
    const admission = { processing: false, release: null };
    req.uploadAdmission = admission;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      active -= 1;
      const remaining = users.get(user) - 1;
      if (remaining) users.set(user, remaining);
      else users.delete(user);
      res.off("finish", responseEnded);
      res.off("close", responseEnded);
    };
    admission.release = release;
    const responseEnded = () => { if (!admission.processing) release(); };
    res.once("finish", responseEnded);
    res.once("close", responseEnded);
    next();
  };
}

// After parsing, storage/DB work can outlive the HTTP connection. Keep its slot
// until that work settles, and never start it for an already disconnected client.
export const handleUpload = handler => async (req, res, next) => {
  const admission = req.uploadAdmission;
  if (res.destroyed) { admission?.release(); return; }
  if (admission) admission.processing = true;
  try { await handler(req, res, next); }
  catch (error) { next(error); }
  finally { admission?.release(); }
};

export default createUploadAdmission();
