import { objectId } from "../validators/authValidator.js";
export default function validate(schema) {
  return async (req, res, next) => {
    try { req.body = await schema.parseAsync(req.body); return next(); }
    catch (error) { return next(error); }
  };
}
export function validateObjectId(req, res, next, value) {
  const result = objectId.safeParse(value);
  if (!result.success) return res.status(400).json({ success: false, message: "Invalid record ID" });
  return next();
}
