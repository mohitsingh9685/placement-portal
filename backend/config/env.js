export function validateEnvironment(env = process.env) {
  for (const key of ["MONGO_URI", "GOOGLE_CLIENT_ID", "CLIENT_URL"]) {
    if (!env[key]?.trim()) throw new Error(`${key} is required`);
  }
  for (const key of ["ACCESS_TOKEN_SECRET", "REFRESH_TOKEN_SECRET"]) {
    if (!env[key] || env[key].length < 32) throw new Error(`${key} must contain at least 32 characters`);
  }
  if (env.ACCESS_TOKEN_SECRET === env.REFRESH_TOKEN_SECRET) throw new Error("Access and refresh token secrets must be different");
  const url = new URL(env.CLIENT_URL);
  if (!["http:", "https:"].includes(url.protocol) || url.origin !== env.CLIENT_URL.replace(/\/$/, "")) {
    throw new Error("CLIENT_URL must be a frontend origin without a path");
  }
  if (env.NODE_ENV === "production" && url.protocol !== "https:") throw new Error("Production CLIENT_URL must use HTTPS");
}
