import { Router, type Request, type Response, type NextFunction } from "express";
import { routePrompt } from "../services/aiRouter.js";
import { Repository } from "../models/Repository.js";

const router = Router();

// ---------------------------------------------------------------------------
// POST /api/ai/route-prompt — Smart AI routing
// ---------------------------------------------------------------------------
router.post("/route-prompt", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { repoId, filePath, prompt, fileContent } = req.body;

    if (!repoId || !prompt) {
      return res.status(400).json({ error: "repoId and prompt are required" });
    }

    // Get file metadata from repository
    const repo = await Repository.findById(repoId);
    if (!repo) {
      return res.status(404).json({ error: "Repository not found" });
    }

    // Find the file in the repo
    const file = filePath ? repo.files.find((f) => f.path === filePath) : null;

    const metadata = {
      lineCount: file?.lineCount || 0,
      dependencyCount: file?.imports.length || 0,
      cyclomaticComplexity: file?.complexity || 0,
    };

    const content = fileContent || "";

    const result = await routePrompt(repoId, filePath || "", prompt, content, metadata);

    return res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    // If Bedrock fails (missing credentials, etc.), return a graceful error
    if ((err as Error).message?.includes("credentials") || (err as Error).name === "CredentialsProviderError") {
      return res.status(503).json({
        error: "AI service unavailable",
        message: "AWS Bedrock credentials not configured. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.",
      });
    }
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/ai/models — List available model tiers
// ---------------------------------------------------------------------------
router.get("/models", (_req: Request, res: Response) => {
  res.json({
    tiers: {
      cheap: {
        label: "Cost-Efficient",
        description: "For simple tasks: formatting, comments, basic refactoring",
        models: ["Amazon Nova Lite", "Amazon Titan Lite"],
      },
      mid: {
        label: "Balanced",
        description: "For moderate tasks: code review, small refactors",
        models: ["Claude 3 Haiku", "Amazon Nova Pro"],
      },
      premium: {
        label: "Premium",
        description: "For complex tasks: architecture changes, security reviews",
        models: ["Claude 3.5 Sonnet"],
      },
    },
    routing: "Automatic — model selected based on code complexity heuristic",
  });
});

export default router;
