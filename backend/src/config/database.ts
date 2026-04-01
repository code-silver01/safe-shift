import mongoose from "mongoose";

const connectDB = async (): Promise<void> => {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/safeshift";

  try {
    const conn = await mongoose.connect(uri);
    console.log(`[DB] MongoDB connected: ${conn.connection.host}:${conn.connection.port}/${conn.connection.name}`);
  } catch (error) {
    console.error("[DB] MongoDB connection error:", error);
    process.exit(1);
  }

  mongoose.connection.on("error", (err) => {
    console.error("[DB] MongoDB runtime error:", err);
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("[DB] MongoDB disconnected. Attempting reconnect...");
  });
};

export default connectDB;
