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

export default router;
