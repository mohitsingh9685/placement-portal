import dotenv from "dotenv";

// Load env variables first
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import connectDB from "./config/db.js";

import authRoutes from "./routes/authRoutes.js";
import { protect } from "./middleware/authMiddleware.js";
import companyRoutes from "./routes/companyRoutes.js";
import applicationRoutes from "./routes/applicationRoutes.js";
import uploadRoutes from "./routes/upload.routes.js";
import compression from "compression";

const app = express();
app.set("trust proxy", 1);

// Middleware
app.use(helmet());
app.use(compression());
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== "production") {
  app.use((req, res, next) => {
    console.log("API HIT:", req.method, req.url);
    next();
  });
}

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is healthy",
  });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/company", companyRoutes);
app.use("/api/application", applicationRoutes);
app.use("/api/v1/upload", uploadRoutes);

// Test route
app.get("/", (req, res) => {
  res.send("API is running...");
});

// Protected test route
app.get("/api/protected", protect, (req, res) => {
  res.json({
    message: "Protected route accessed",
    user: req.user,
  });
});

const PORT = process.env.PORT || 9000;

const startServer = async () => {
  try {
    console.log("Starting server...");
    
    await connectDB(); // wait for DB connection

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

  } catch (error) {
    console.error("Server failed to start:", error.message);
    process.exit(1);
  }
};

startServer();
