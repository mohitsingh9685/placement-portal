import mongoose from "mongoose";

mongoose.set("strictQuery", true);
// Schema/index changes are applied by the explicit migration, never by server startup.
mongoose.set("autoIndex", false);
mongoose.set("autoCreate", false);

const connectDB = async () => {
  try {
    console.log("Connecting to MongoDB...");
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error("DB connection failed:", error.message);
    process.exit(1);
  }
};

export default connectDB;