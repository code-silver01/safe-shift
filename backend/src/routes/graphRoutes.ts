import { Router, type Request, type Response, type NextFunction } from "express";
import { getGraphForRepo, getBlastRadius } from "../services/dependencyGraph.js";

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/repo/:id/graph — Get full dependency graph
// ---------------------------------------------------------------------------
router.get("/:id/graph", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const graph = await getGraphForRepo(req.params.id as string);
    if (!graph) {
      return res.status(404).json({ error: "Dependency graph not found. Repository may still be analyzing." });
    }

    return res.json({
      repoId: req.params.id,
      nodes: graph.nodes,
      edges: graph.edges,
      stats: {
        totalNodes: graph.nodes.length,
        totalEdges: graph.edges.length,
        avgDependencies: graph.nodes.length > 0
          ? Math.round(graph.edges.length / graph.nodes.length * 10) / 10
          : 0,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/repo/:id/simulate — Blast radius simulation
// ---------------------------------------------------------------------------
router.post("/:id/simulate", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { filePath } = req.body;
    if (!filePath || typeof filePath !== "string") {
      return res.status(400).json({ error: "filePath is required in request body" });
    }

    const result = await getBlastRadius(req.params.id as string, filePath);
    return res.json({
      repoId: req.params.id,
      sourceFile: filePath,
      ...result,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/repo/:id/ts-graph — TS Compiler API Graph + Community Detection
// ---------------------------------------------------------------------------
router.get("/:id/ts-graph", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { Repository } = await import("../models/Repository.js");
    const repo = await Repository.findById(req.params.id as string);
    if (!repo) {
      return res.status(404).json({ error: "Repository not found" });
    }
    if (!repo.clonePath) {
      return res.status(400).json({ error: "Repository has not been cloned. Run analysis first." });
    }

    const fs = await import("fs");
    if (!fs.existsSync(repo.clonePath)) {
      return res.status(404).json({ error: "Repository files no longer exist on disk. Please re-run the analysis." });
    }

    const { buildTsCompilerGraph } = await import("../services/tsCompilerGraph.js");
    const graph = buildTsCompilerGraph(repo.clonePath);

    return res.json({
      repoId: req.params.id,
      nodes: graph.nodes.map((n) => ({
        id: n.id,
        label: n.label,
        type: n.language,
        community: n.community,
        isEntryPoint: n.isEntryPoint,
        inDegree: n.inDegree,
        outDegree: n.outDegree,
        externalImports: n.externalImports,
      })),
      edges: graph.edges,
      communities: graph.communities,
      stats: graph.stats,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
