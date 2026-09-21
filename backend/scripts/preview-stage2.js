import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import express from "express";
import mongoose from "mongoose";

// Disposable synthetic preview only. It never loads the application's .env.
if (process.env.NODE_ENV === "production") throw new Error("The synthetic preview cannot run in production");
const uri = process.env.TEST_MONGO_URI;
const target = new URL(uri);
if (target.protocol !== "mongodb:" || !["127.0.0.1", "localhost", "[::1]"].includes(target.hostname) || target.username || target.password) throw new Error("TEST_MONGO_URI must point to an unauthenticated localhost replica set");
const root = fileURLToPath(new URL("../../", import.meta.url));
process.env.NODE_ENV = "test";
process.env.CLIENT_URL = "http://localhost:5187";
process.env.GOOGLE_CLIENT_ID = "synthetic-preview";
process.env.ACCESS_TOKEN_SECRET = `preview-access-${randomUUID()}-${randomUUID()}`;
process.env.REFRESH_TOKEN_SECRET = `preview-refresh-${randomUUID()}-${randomUUID()}`;
process.env.VITE_API_URL = "http://localhost:9107/api";
process.env.VITE_GOOGLE_CLIENT_ID = "synthetic-preview";
for (const key of Object.keys(process.env)) if (key === "MONGO_URI" || key === "REDIS_URL" || key.startsWith("AWS_") || key.startsWith("CLOUDINARY_")) delete process.env[key];
const dbName = `placement_portal_preview_${randomUUID().replaceAll("-", "")}`;
let vite, api;
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await vite?.close();
  if (api) { api.closeAllConnections(); await new Promise(resolve => api.close(resolve)); }
  if (mongoose.connection.name === dbName) await mongoose.connection.db.dropDatabase();
  await mongoose.disconnect();
}
try {
  await mongoose.connect(uri, { dbName, autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000 });
  const { seedLegacyFixture } = await import("../tests/helpers/legacyFixture.js");
  const { applyStage2 } = await import("../migrations/stage2.js");
  const fixture = await seedLegacyFixture(mongoose.connection.db);
  await applyStage2(mongoose.connection);
  const { default: Admin } = await import("../models/Admin.js");
  const { bootstrapSuperAdmin } = await import("../services/adminManagementService.js");
  await bootstrapSuperAdmin(fixture.admin.email, { apply: true });
  const limitedAdmin = await Admin.create({ name: "Read-only Admin", email: "reader@example.invalid", role: "admin", permissions: ["students.view", "applications.view"] });
  const { default: Student } = await import("../models/Student.js");
  await Student.updateOne({ _id: fixture.studentId }, { $set: { course: "B.Tech", tenthPercentage: 80, twelfthPercentage: 75 } });
  const { default: ApprovedStudent } = await import("../models/ApprovedStudent.js");
  await ApprovedStudent.create({ email: "new-student@example.invalid", role: "student", isActive: true });
  const newStudent = await Student.create({ name: "Google Display Name", email: "new-student@example.invalid", role: "student", profileCompleted: false });
  const { createSession } = await import("../services/authService.js");
  const { setAuthCookies } = await import("../config/cookie.js");
  const { createApp } = await import("../app.js");
  const app = express();
  // Synthetic documents stay in memory; this preview never contacts S3.
  const { documentStorage } = await import("../services/driveDocumentService.js");
  const documents = new Map();
  documentStorage.upload = async file => { const key = randomUUID(); documents.set(key, file); return { key }; };
  documentStorage.remove = async key => { documents.delete(key); };
  documentStorage.sign = async key => `http://localhost:9107/__documents/${encodeURIComponent(key)}`;
  app.get("/__documents/:key", (req, res) => {
    const file = documents.get(req.params.key);
    if (!file) return res.status(404).send("Synthetic document not found");
    res.type(file.mimetype).send(file.buffer);
  });
  app.get("/__fixture/:kind", async (req, res) => {
    const user = req.params.kind === "admin" ? await Admin.findById(fixture.adminId)
      : req.params.kind === "limited-admin" ? await Admin.findById(limitedAdmin._id)
      : await Student.findById(req.params.kind === "new-student" ? newStudent._id : fixture.studentId);
    setAuthCookies(res, await createSession(user));
    res.redirect(process.env.CLIENT_URL);
  });
  app.use((req, res, next) => {
    const cloudRequest = req.path.startsWith("/api/v1/upload/") && (req.method !== "GET" || req.path.includes("/view"));
    if (cloudRequest || req.path === "/api/auth/google") return res.status(501).json({ message: "Cloud uploads and Google sign-in are disabled in the synthetic preview" });
    next();
  });
  app.use(createApp({ rateLimit: false }));
  api = await new Promise((resolve, reject) => {
    const server = app.listen(9107, "127.0.0.1", () => resolve(server));
    server.once("error", reject);
  });
  process.chdir(`${root}/frontend`);
  const { createServer } = await import("../../frontend/node_modules/vite/dist/node/index.js");
  vite = await createServer({
    root: `${root}/frontend`, envDir: false,
    plugins: [{ name: "synthetic-google", enforce: "pre",
      resolveId(id) { if (id === "@react-oauth/google") return "\0synthetic-google"; },
      load(id) { if (id === "\0synthetic-google") return "import { createElement } from 'react'; export const GoogleOAuthProvider = ({children}) => children; export const GoogleLogin = () => createElement('span', null, 'Google sign-in disabled in synthetic preview');"; },
    }],
    server: { host: "127.0.0.1", port: 5187, strictPort: true },
  });
  await vite.listen();
  console.log("Synthetic preview only — all changes are discarded on exit.\nSuper Admin: http://localhost:9107/__fixture/admin\nRead-only Admin: http://localhost:9107/__fixture/limited-admin\nStudent: http://localhost:9107/__fixture/student\nFirst-time student: http://localhost:9107/__fixture/new-student\nPress Ctrl+C to stop and remove the temporary database.");
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => stop().then(() => process.exit(0)));
} catch (error) { console.error(error.message); await stop(); process.exitCode = 1; }
