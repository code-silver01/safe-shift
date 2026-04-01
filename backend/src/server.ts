import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { connectNeo4j } from "./config/neo4j.js";
import repoRoutes from "./routes/repoRoutes.js";
import graphRoutes from "./routes/graphRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import analysisRoutes from "./routes/analysisRoutes.js";
import businessRoutes from "./routes/businessRoutes.js";

const app = express();
const PORT = parseInt(process.env.PORT || "3001", 10);

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(morgan("dev"));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/repo", repoRoutes);
app.use("/api/repo", graphRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/repo", analysisRoutes);
app.use("/api/repo", businessRoutes);

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("[ERROR]", err.message, err.stack);
    res.status(500).json({
      error: "Internal Server Error",
      message: process.env.NODE_ENV === "production" ? "Something went wrong" : err.message,
    });
  }
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
const start = async () => {
  await connectNeo4j();
  app.listen(PORT, () => {
    console.log(`[SERVER] SafeShift backend running on http://localhost:${PORT}`);
    console.log(`[SERVER] Health check: http://localhost:${PORT}/api/health`);
  });
};

start().catch((err) => {
  console.error("[FATAL] Failed to start server:", err);
  process.exit(1);
});

export default app;
