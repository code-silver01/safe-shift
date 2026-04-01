import { Router, type Request, type Response, type NextFunction } from "express";
import { Repository } from "../models/Repository.js";
import { cloneRepo, listSourceFiles, readFileContent, getRelativePath, cleanupRepo } from "../services/gitService.js";
import { parseFile } from "../services/astParser.js";
import { runStaticAnalysis } from "../services/staticAnalysis.js";
import { buildDependencyGraph } from "../services/dependencyGraph.js";
import { generateBusinessTags } from "../services/businessImpact.js";

const router = Router();

// ---------------------------------------------------------------------------
// POST /api/repo/analyze — Start analysis of a GitHub repository
// ---------------------------------------------------------------------------
router.post("/analyze", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { repoUrl } = req.body;
    if (!repoUrl || typeof repoUrl !== "string") {
      return res.status(400).json({ error: "repoUrl is required" });
    }

    // Normalize repo identifier
    const match = repoUrl.trim().match(/(?:github\.com\/)?([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)/);
    if (!match) {
      return res.status(400).json({ error: "Invalid repository format. Use owner/repo or a GitHub URL." });
    }
    const repoName = match[1].replace(/\.git$/, "");

    // Create repository record
    const repo = await Repository.create({
      name: repoName,
      fullUrl: `https://github.com/${repoName}.git`,
      status: "queued",
      statusMessage: "Analysis queued...",
      progress: 0,
    });

    // Start async analysis pipeline
    analyzeRepository(repo.id).catch((err) => {
      console.error(`[ANALYSIS] Pipeline failed for ${repoName}:`, err);
    });

    return res.status(201).json({
      id: repo.id,
      name: repo.name,
      status: repo.status,
      message: "Analysis started",
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/repo/:id/status — Get analysis progress
// ---------------------------------------------------------------------------
router.get("/:id/status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = await Repository.findById(req.params.id as string);
    if (!repo) {
      return res.status(404).json({ error: "Repository not found" });
    }
    return res.json({
      id: repo.id,
      name: repo.name,
      status: repo.status,
      statusMessage: repo.statusMessage,
      progress: repo.progress,
      totalFiles: repo.totalFiles,
      totalLines: repo.totalLines,
      languages: repo.languages,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/repo/:id/files — Get parsed file tree
// ---------------------------------------------------------------------------
router.get("/:id/files", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = await Repository.findById(req.params.id as string);
    if (!repo) {
      return res.status(404).json({ error: "Repository not found" });
    }

    // Build tree structure from flat file list
    const tree = buildFileTree(repo.files.map((f) => ({
      path: f.path,
      language: f.language,
      lineCount: f.lineCount,
      complexity: f.complexity,
      riskLevel: f.riskLevel,
      riskScore: f.riskScore,
      testCoverage: f.testCoverage,
      hasTests: f.hasTests,
      imports: f.imports.length,
      exports: f.exports.length,
      functions: f.functions.length,
    })));

    return res.json({
      id: repo.id,
      name: repo.name,
      tree,
      flatFiles: repo.files.map((f) => ({
        path: f.path,
        language: f.language,
        lineCount: f.lineCount,
        complexity: f.complexity,
        riskLevel: f.riskLevel,
        riskScore: f.riskScore,
        testCoverage: f.testCoverage,
        hasTests: f.hasTests,
        importCount: f.imports.length,
        exportCount: f.exports.length,
        functionCount: f.functions.length,
        functions: f.functions,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /api/repo/:id/file-content — Get raw file content (for editor)
// ---------------------------------------------------------------------------
router.get("/:id/file-content", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { filePath } = req.query;
    if (!filePath || typeof filePath !== "string") {
      return res.status(400).json({ error: "filePath query parameter required" });
    }

    const repo = await Repository.findById(req.params.id as string);
    if (!repo) return res.status(404).json({ error: "Repository not found" });

    // Read from cloned repo if still on disk
    const fs = await import("fs/promises");
    const path = await import("path");
    const fullPath = path.default.join(repo.clonePath, filePath);

    try {
      const content = await fs.default.readFile(fullPath, "utf-8");
      const file = repo.files.find((f) => f.path === filePath);
      return res.json({
        path: filePath,
        content,
        language: file?.language || "unknown",
        lineCount: file?.lineCount || 0,
        complexity: file?.complexity || 0,
        riskLevel: file?.riskLevel || "low",
      });
    } catch {
      return res.status(404).json({ error: "File not found on disk. Repository may have been cleaned up." });
    }
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Async analysis pipeline
// ---------------------------------------------------------------------------
async function analyzeRepository(repoId: string): Promise<void> {
  const repo = await Repository.findById(repoId);
  if (!repo) throw new Error("Repository not found");

  try {
    // Step 1: Clone
    await updateStatus(repoId, "cloning", "Cloning repository...", 5);
    const { clonePath, fullUrl } = await cloneRepo(repo.name);
    await Repository.findByIdAndUpdate(repoId, { clonePath, fullUrl });

    // Step 2: Scan files
    await updateStatus(repoId, "parsing", "Scanning file structure...", 15);
    const filePaths = await listSourceFiles(clonePath);
    await updateStatus(repoId, "parsing", `Found ${filePaths.length} source files. Parsing...`, 20);

    // Step 3: Parse each file
    const fileContents = new Map<string, string>();
    const parsedFiles = [];
    let parsed = 0;

    for (const filePath of filePaths) {
      const content = await readFileContent(filePath);
      const relativePath = getRelativePath(filePath, clonePath);
      fileContents.set(relativePath, content);

      const fileData = parseFile(filePath, content, clonePath);
      parsedFiles.push({
        ...fileData,
        complexity: 0,
        testCoverage: 0,
        riskScore: 0,
        riskLevel: "low" as const,
      } as any); // Cast as any to bypass temporary missing fields since parseFile doesn't return full IFileEntry

      parsed++;
      if (parsed % 50 === 0 || parsed === filePaths.length) {
        const progress = 20 + Math.round((parsed / filePaths.length) * 30);
        updateStatus(repoId, "parsing", `Parsed ${parsed}/${filePaths.length} files...`, progress).catch(console.error);
      }
    }

    // Update repo with parsed files
    const languages: Record<string, number> = {};
    let totalLines = 0;
    for (const f of parsedFiles) {
      languages[f.language] = (languages[f.language] || 0) + 1;
      totalLines += f.lineCount;
    }

    await Repository.findByIdAndUpdate(repoId, {
      files: parsedFiles,
      totalFiles: parsedFiles.length,
      totalLines,
      languages,
    });

    // Step 4: Static analysis (complexity, coverage, risk)
    await updateStatus(repoId, "analyzing", "Calculating complexity and coverage...", 55);
    await runStaticAnalysis(repoId, fileContents);

    // Step 5: Build dependency graph
    await updateStatus(repoId, "building_graph", "Mapping dependencies...", 70);
    await buildDependencyGraph(repoId);

    // Step 6: Risk scoring (re-run with graph data)
    await updateStatus(repoId, "scoring", "Computing risk scores...", 85);
    // Re-run with updated dependency counts from graph
    await runStaticAnalysis(repoId, fileContents);

    // Step 7: Generate business tags
    await updateStatus(repoId, "scoring", "Generating business impact tags...", 92);
    await generateBusinessTags(repoId);

    // Done!
    await updateStatus(repoId, "ready", "Analysis complete!", 100);
  } catch (error) {
    console.error(`[ANALYSIS] Error:`, error);
    await updateStatus(repoId, "error", `Analysis failed: ${(error as Error).message}`, 0);
    // Attempt cleanup
    if (repo.clonePath) {
      try { 
        await cleanupRepo(repo.clonePath); 
        await Repository.findByIdAndUpdate(repoId, { clonePath: "" });
      } catch { /* ignore */ }
    }
  }
}

async function updateStatus(repoId: string, status: any, message: string, progress: number): Promise<void> {
  await Repository.findByIdAndUpdate(repoId, {
    status,
    statusMessage: message,
    progress,
  });
  console.log(`[ANALYSIS] [${repoId}] ${status}: ${message} (${progress}%)`);
}

// ---------------------------------------------------------------------------
// Utility: Build file tree from flat paths
// ---------------------------------------------------------------------------
interface TreeNode {
  name: string;
  type: "folder" | "file";
  path: string;
  children?: TreeNode[];
  metadata?: Record<string, any>;
}

function buildFileTree(files: Array<{ path: string; [key: string]: any }>): TreeNode[] {
  const root: TreeNode[] = [];

  for (const file of files) {
    const parts = file.path.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const isLast = i === parts.length - 1;

      let existing = current.find((n) => n.name === name);

      if (!existing) {
        if (isLast) {
          // File node
          const { path: _, ...metadata } = file;
          existing = { name, type: "file", path: file.path, metadata };
        } else {
          // Folder node
          existing = { name, type: "folder", path: parts.slice(0, i + 1).join("/"), children: [] };
        }
        current.push(existing);
      }

      if (!isLast && existing.children) {
        current = existing.children;
      }
    }
  }

  return root;
}

export default router;
