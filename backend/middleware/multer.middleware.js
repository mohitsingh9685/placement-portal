import multer from "multer";

const storage = multer.memoryStorage();

// These endpoints accept one file; document metadata is sent in the query.
// Bound the whole multipart shape so text fields cannot bypass file-size limits.
const singleFileLimits = {
  files: 1,
  fields: 0,
  parts: 2,
  fieldNameSize: 100,
  fieldSize: 1024,
};

const imageFileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/jpg",
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"), false);
  }
};

const resumeFileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only PDF/DOC/DOCX files are allowed"), false);
  }
};

const jdFileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/jpeg", "image/jpg", "image/png", "image/webp",
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only PDF/DOC/DOCX and PNG/JPG/WEBP documents are allowed"), false);
  }
};

export const uploadProfilePhotoMiddleware = multer({
  storage,
  limits: {
    ...singleFileLimits,
    fileSize: 2 * 1024 * 1024,
  },
  fileFilter: imageFileFilter,
});

export const uploadResumeMiddleware = multer({
  storage,
  limits: {
    ...singleFileLimits,
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: resumeFileFilter,
});

export const uploadJDMiddleware = multer({
  storage,
  limits: {
    ...singleFileLimits,
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: jdFileFilter,
});
