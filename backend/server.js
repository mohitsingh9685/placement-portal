const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");

const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const { protect } = require("./middleware/authMiddleware");

// Load env variables
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);

// Test route
app.get("/", (req, res) => {
  res.send("API is running...");
});

// Protected test route
app.get("/api/protected", protect, (req, res) => {
  res.json({
    message: "Protected route accessed",
    user: req.user
  });
});

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});