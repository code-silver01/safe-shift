import { Router, type Request, type Response, type NextFunction } from "express";
import { getRiskMetrics } from "../services/staticAnalysis.js";
import {
  parseCoverageFinalJson,
  calculatePriorityScores,
  generateCoverageSummary,
} from "../services/coverageIngestion.js";

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

// ---------------------------------------------------------------------------
// POST /api/repo/:id/coverage — Upload real coverage-final.json
// Accepts: { coverageJson: <contents of coverage-final.json> }
// Returns: parsed coverage data + priority scores for every file
// ---------------------------------------------------------------------------
router.post("/:id/coverage", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { coverageJson, projectRoot } = req.body;
    if (!coverageJson || typeof coverageJson !== "object") {
      return res.status(400).json({
        error: "coverageJson is required. Pass the parsed contents of coverage-final.json as a JSON object.",
      });
    }

    // Import Repository model
    const { Repository } = await import("../models/Repository.js");
    const repo = await Repository.findById(req.params.id as string);
    if (!repo) {
      return res.status(404).json({ error: "Repository not found" });
    }

    // Parse the coverage JSON
    const coverageData = parseCoverageFinalJson(coverageJson, projectRoot);

    // Build complexity map from the repo's analyzed files
    const complexityMap: Record<string, number> = {};
    for (const file of repo.files) {
      complexityMap[file.path] = file.complexity;
    }

    // Calculate Priority = Complexity / (Coverage + 0.01) + 1
    const priorityScores = calculatePriorityScores(complexityMap, coverageData);

    // Generate summary
    const summary = generateCoverageSummary(coverageData, priorityScores);

    return res.json({
      repoId: req.params.id,
      coverageData,
      priorityScores,
      summary,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/repo/:id/priority — Get priority scores (complexity / coverage + 1)
// Uses the heuristic coverage estimates from static analysis (no JSON upload required)
// ---------------------------------------------------------------------------
router.get("/:id/priority", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { Repository } = await import("../models/Repository.js");
    const repo = await Repository.findById(req.params.id as string);
    if (!repo) {
      return res.status(404).json({ error: "Repository not found" });
    }

    // Build scores from existing analysis data
    const scores = repo.files
      .filter((f) => !f.hasTests) // exclude test files themselves
      .map((f) => {
        const coverageNorm = (f.testCoverage || 0) / 100;
        const priority = f.complexity / (coverageNorm + 0.01) + 1;
        return {
          filePath: f.path,
          fileName: f.path.split("/").pop() || f.path,
          complexity: f.complexity,
          coverage: f.testCoverage,
          priorityScore: Math.round(priority * 100) / 100,
          riskLevel: priority > 100 ? "critical" as const
            : priority > 30 ? "high" as const
            : priority > 10 ? "medium" as const
            : "low" as const,
        };
      })
      .sort((a, b) => b.priorityScore - a.priorityScore);

    return res.json({
      repoId: req.params.id,
      totalFiles: scores.length,
      priorityScores: scores,
    });
  } catch (err) {
    next(err);
  }
});

export default router;

