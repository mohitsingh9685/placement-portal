import "dotenv/config";
import { validateEnvironment } from "./config/env.js";
import connectDB from "./config/db.js";

try {
  validateEnvironment();
  const { createApp } = await import("./app.js");
  const { connectRedis } = await import("./config/redis.js");
  await connectDB();
  connectRedis();
  createApp().listen(process.env.PORT || 9000, () => console.log("Placement API started"));
} catch (error) {
  console.error("Server failed to start:", error.message);
  process.exitCode = 1;
}
