import { Router, type Request, type Response, type NextFunction } from "express";
import { getRiskMetrics } from "../services/staticAnalysis.js";

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/repo/:id/risk-scores — Get risk analysis for all files
// ---------------------------------------------------------------------------
router.get("/:id/risk-scores", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const metrics = await getRiskMetrics(req.params.id as string);
    return res.json({
      repoId: req.params.id,
      ...metrics,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
