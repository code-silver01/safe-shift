import { Router, type Request, type Response, type NextFunction } from "express";
import { getBusinessImpact, generateBusinessTags } from "../services/businessImpact.js";
import { BusinessTag } from "../models/BusinessTag.js";

const router = Router();

// ---------------------------------------------------------------------------
// GET /api/repo/:id/business-impact — Executive dashboard data
// ---------------------------------------------------------------------------
router.get("/:id/business-impact", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const impact = await getBusinessImpact(req.params.id as string);
    return res.json({
      repoId: req.params.id,
      ...impact,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/repo/:id/business-tags — Manual tag management
// ---------------------------------------------------------------------------
router.post("/:id/business-tags", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rules } = req.body;
    if (!rules || !Array.isArray(rules)) {
      return res.status(400).json({ error: "rules array is required" });
    }

    await BusinessTag.findOneAndUpdate(
      { repoId: req.params.id as string },
      { repoId: req.params.id as string, rules }
    );

    return res.json({ success: true, tags: { rules } });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /api/repo/:id/business-tags/auto — Re-generate auto tags
// ---------------------------------------------------------------------------
router.post("/:id/business-tags/auto", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await generateBusinessTags(req.params.id as string);
    const tags = await BusinessTag.findOne({ repoId: req.params.id as string });
    return res.json({ success: true, tags });
  } catch (err) {
    next(err);
  }
});

export default router;
