import redis from "../config/redis.js";
export const COMPANIES_CACHE_KEY = "companies:v3:all";
export function createCompanyCache(client, timeoutMs = 600) {
  async function attempt(operation, fallback) {
    if (client?.status !== "ready") return fallback;
    let timer;
    try {
      return await Promise.race([
        Promise.resolve().then(operation),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Cache timeout")), timeoutMs); }),
      ]);
    } catch { return fallback; }
    finally { clearTimeout(timer); }
  }
  return {
    async get() {
      const value = await attempt(() => client.get(COMPANIES_CACHE_KEY), null);
      try { const data = JSON.parse(value); return Array.isArray(data) ? data : null; } catch { return null; }
    },
    set: (companies) => attempt(() => client.set(COMPANIES_CACHE_KEY, JSON.stringify(companies), "EX", 300), null),
    invalidate: () => attempt(() => client.del(COMPANIES_CACHE_KEY, "companies:v2:all", "all_companies"), null),
  };
}
export default createCompanyCache(redis);
