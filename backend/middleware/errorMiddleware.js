export default function errorMiddleware(error, req, res, next) {
  if (res.headersSent) return next(error);
  let status = error.statusCode || error.status || 500;
  let message = error.message || "Internal server error";
  if (error.name === "ZodError") { status = 400; message = error.issues?.[0]?.message || "Invalid request"; }
  if (["CastError", "ValidationError"].includes(error.name)) { status = 400; message = "Invalid record data"; }
  if (error.code === 11000) { status = 409; message = "This record already exists"; }
  if (error.type === "entity.parse.failed") { status = 400; message = "Invalid JSON body"; }
  if (status >= 500) {
    console.error("Request failed:", req.method, req.path, error.name);
    message = "Service temporarily unavailable. Please try again.";
  }
  return res.status(status).json({ success: false, message,
    ...(typeof error.code === "string" ? { code: error.code } : {}),
  });
}
