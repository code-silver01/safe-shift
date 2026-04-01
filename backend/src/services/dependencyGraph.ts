import { Repository } from "../models/Repository.js";
import { resolveImportPath } from "./astParser.js";
import { MemoryGraph } from "../config/memoryStore.js";

// ---------------------------------------------------------------------------
// Build dependency graph from parsed repository data
// ---------------------------------------------------------------------------
export async function buildDependencyGraph(repoId: string): Promise<void> {
  const repo = await Repository.findById(repoId);
  if (!repo || !repo.files) throw new Error(`Repository ${repoId} not found or has no files`);

  const allFilePaths = repo.files.map((f) => f.path);
  const fileMap = new Map<string, boolean>();
  for (const file of repo.files) {
    fileMap.set(file.path, true);
  }

  const relationships: Array<{ source: string; target: string }> = [];
  const edgeSet = new Set<string>();

  for (const file of repo.files) {
    for (const importSource of file.imports) {
      const resolved = resolveImportPath(importSource, file.path, allFilePaths);
      if (resolved && fileMap.has(resolved)) {
        const edgeKey = `${file.path}|${resolved}`;
        if (!edgeSet.has(edgeKey)) {
          edgeSet.add(edgeKey);
          relationships.push({
            source: file.path,
            target: resolved,
          });
        }
      }
    }
  }

  // Save in memory
  MemoryGraph.setEdges(repoId, relationships);
}

// ---------------------------------------------------------------------------
// Blast Radius: BFS to find all downstream dependents
// ---------------------------------------------------------------------------
export async function getBlastRadius(
  repoId: string,
  filePath: string
): Promise<{
  affectedFiles: Array<{ path: string; depth: number; riskLevel: string }>;
  totalAffected: number;
}> {
  return MemoryGraph.getBlastRadius(repoId, filePath);
}

/**
 * Get the full dependency graph for a repository
 */
export async function getGraphForRepo(repoId: string) {
  return MemoryGraph.getGraphForRepo(repoId);
}
