import Admin from "../models/Admin.js";
import { PERMISSIONS } from "../config/permissions.js";
import { createAdminAccount, updateAdminAccount } from "../services/adminManagementService.js";
import { serializeUser } from "../services/authService.js";

export async function listAdmins(req, res, next) {
  try {
    const page = Math.max(1, Math.min(10000, Math.floor(Number(req.query.page)) || 1));
    const filter = {};
    if (req.query.search) {
      const term = String(req.query.search).slice(0, 200).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [{ name: { $regex: term, $options: "i" } }, { email: { $regex: term, $options: "i" } }];
    }
    const [admins, total] = await Promise.all([Admin.find(filter).sort({ email: 1 }).skip((page - 1) * 30).limit(30).lean(), Admin.countDocuments(filter)]);
    res.json({ admins: admins.map(serializeUser), permissions: PERMISSIONS, page, pages: Math.max(1, Math.ceil(total / 30)), total });
  } catch (error) { next(error); }
}
export async function addAdmin(req, res, next) {
  try { res.status(201).json({ success: true, admin: serializeUser(await createAdminAccount(req.user._id, req.body)) }); }
  catch (error) { next(error); }
}
export async function editAdmin(req, res, next) {
  try { res.json({ success: true, admin: serializeUser(await updateAdminAccount(req.user._id, req.params.adminId, req.body)) }); }
  catch (error) { next(error); }
}
