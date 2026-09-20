export function allowedOrigins(env = process.env) {
  return new Set([
    ...(env.NODE_ENV !== "production" ? ["http://localhost:5173"] : []),
    ...(env.CLIENT_URL ? [env.CLIENT_URL.replace(/\/$/, "")] : []),
  ]);
}
export function corsOptions() {
  const origins = allowedOrigins();
  return { origin(origin, callback) { callback(null, !origin || origins.has(origin)); }, credentials: true };
}
