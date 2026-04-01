import { Router, type Request, type Response, type NextFunction } from "express";
import { routePrompt } from "../services/aiRouter.js";
import { Repository } from "../models/Repository.js";
import { classifyPrompt, decisionToTier, type RouteDecision } from "../services/localRouter.js";

const router = Router();

// ---------------------------------------------------------------------------
// POST /api/ai/route-prompt — Smart AI routing via local Transformers.js
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

    // ── Step 1: Local Classification (Transformers.js — zero cost) ────
    let localDecision: RouteDecision;
    try {
      localDecision = await classifyPrompt(prompt);
    } catch (routerErr) {
      console.warn("[AI Routes] Local router failed, using heuristic fallback:", routerErr);
      // Fallback: use the existing complexity heuristic
      localDecision = {
        cluster: metadata.cyclomaticComplexity > 10 ? "complex" : "simple",
        confidence: 0.5,
        simpleScore: 0,
        complexScore: 0,
        reasoning: "Fallback: local router unavailable, using complexity heuristic.",
      };
    }

    // ── Step 2: Map decision to model tier ────────────────────────────
    const tier = decisionToTier(localDecision);

    // ── Step 3: Invoke the actual AI model via Bedrock ────────────────
    try {
      const result = await routePrompt(repoId, filePath || "", prompt, content, metadata);

      return res.json({
        success: true,
        ...result,
        // Enrich with local router metadata
        localRouterDecision: {
          cluster: localDecision.cluster,
          confidence: localDecision.confidence,
          simpleScore: localDecision.simpleScore,
          complexScore: localDecision.complexScore,
          reasoning: localDecision.reasoning,
          mappedTier: tier,
        },
      });
    } catch (bedrockErr) {
      // If Bedrock fails (missing credentials, etc.), return local classification
      // with a helpful message — the routing analysis itself is still valuable
      console.warn("[AI Routes] Bedrock invocation failed:", bedrockErr);

      return res.json({
        success: true,
        response: `[Local Analysis] This task was classified as **${localDecision.cluster}** (confidence: ${(localDecision.confidence * 100).toFixed(1)}%). ${localDecision.reasoning}\n\nThe AI model is currently unavailable, but the routing decision shows this prompt would be sent to a **${tier}** tier model. Configure AWS Bedrock credentials to get a full AI response.`,
        modelName: "Local Router (Transformers.js)",
        modelId: "local/all-MiniLM-L6-v2",
        complexityTier: tier,
        complexityScore: Math.round(localDecision.complexScore * 100),
        complexityReasoning: localDecision.reasoning,
        inputTokens: 0,
        outputTokens: 0,
        costUSD: 0,
        savingsUSD: 0,
        latencyMs: 0,
        localRouterDecision: {
          cluster: localDecision.cluster,
          confidence: localDecision.confidence,
          simpleScore: localDecision.simpleScore,
          complexScore: localDecision.complexScore,
          reasoning: localDecision.reasoning,
          mappedTier: tier,
        },
      });
    }
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/ai/classify — Classify a prompt locally (no Bedrock call)
// Useful for testing the local router in isolation
// ---------------------------------------------------------------------------
router.post("/classify", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "prompt is required" });
    }

    const decision = await classifyPrompt(prompt);
    const tier = decisionToTier(decision);

    return res.json({
      prompt: prompt.slice(0, 100) + (prompt.length > 100 ? "..." : ""),
      classification: decision.cluster,
      tier,
      confidence: decision.confidence,
      scores: {
        simple: decision.simpleScore,
        complex: decision.complexScore,
      },
      reasoning: decision.reasoning,
    });
  } catch (err) {
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
        routedBy: "Local Router → simple cluster",
      },
      mid: {
        label: "Balanced",
        description: "For moderate tasks: code review, small refactors",
        models: ["Claude 3 Haiku", "Amazon Nova Pro"],
        routedBy: "Local Router → complex cluster (low confidence)",
      },
      premium: {
        label: "Premium",
        description: "For complex tasks: architecture changes, blast radius analysis",
        models: ["Claude 3.5 Sonnet"],
        routedBy: "Local Router → complex cluster (high confidence)",
      },
    },
    routing: "Local Transformers.js (all-MiniLM-L6-v2) — zero cost, instant classification",
  });
});

export default router;

