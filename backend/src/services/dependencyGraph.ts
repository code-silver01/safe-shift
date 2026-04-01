import { Repository, type IFileEntry } from "../models/Repository.js";
import { DependencyGraph, type IGraphNode, type IGraphEdge } from "../models/DependencyGraph.js";
import { resolveImportPath } from "./astParser.js";
import type { Types } from "mongoose";

// ---------------------------------------------------------------------------
// Build dependency graph from parsed repository data
// ---------------------------------------------------------------------------
export async function buildDependencyGraph(repoId: string): Promise<{
  nodes: IGraphNode[];
  edges: IGraphEdge[];
}> {
  const repo = await Repository.findById(repoId);
  if (!repo) throw new Error(`Repository ${repoId} not found`);

  const allFilePaths = repo.files.map((f) => f.path);
  const fileMap = new Map<string, IFileEntry>();
  for (const file of repo.files) {
    fileMap.set(file.path, file);
  }

  const nodes: IGraphNode[] = [];
  const edges: IGraphEdge[] = [];
  const edgeSet = new Set<string>(); // prevent duplicates

  // Build adjacency data
  const inDegree = new Map<string, number>();
  const outDegree = new Map<string, number>();

  for (const file of repo.files) {
    inDegree.set(file.path, 0);
    outDegree.set(file.path, 0);
  }

  // Create edges from imports
  for (const file of repo.files) {
    for (const importSource of file.imports) {
      const resolved = resolveImportPath(importSource, file.path, allFilePaths);
      if (resolved && fileMap.has(resolved)) {
        const edgeKey = `${file.path}|${resolved}`;
        if (!edgeSet.has(edgeKey)) {
          edgeSet.add(edgeKey);
          edges.push({
            source: file.path,
            target: resolved,
            type: "import",
          });
          outDegree.set(file.path, (outDegree.get(file.path) || 0) + 1);
          inDegree.set(resolved, (inDegree.get(resolved) || 0) + 1);
        }
      }
    }
  }

  // Create nodes
  for (const file of repo.files) {
    const depCount = (inDegree.get(file.path) || 0) + (outDegree.get(file.path) || 0);
    nodes.push({
      id: file.path,
      label: file.path.split("/").pop() || file.path,
      type: file.language,
      lineCount: file.lineCount,
      complexity: file.complexity,
      riskLevel: file.riskLevel,
      dependencyCount: depCount,
    });
  }

  // Save to DB
  await DependencyGraph.findOneAndUpdate(
    { repoId: repo._id },
    { repoId: repo._id, nodes, edges },
    { upsert: true, new: true }
  );

  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// Blast Radius: BFS from a file to find all downstream dependents
// ---------------------------------------------------------------------------
export async function getBlastRadius(
  repoId: string,
  filePath: string
): Promise<{
  affectedFiles: Array<{ path: string; depth: number; riskLevel: string }>;
  totalAffected: number;
}> {
  const graph = await DependencyGraph.findOne({ repoId });
  if (!graph) throw new Error(`No dependency graph found for repo ${repoId}`);

  // Build reverse adjacency list (who depends on this file?)
  // edge: source imports target → if target changes, source is affected
  const reverseAdj = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (!reverseAdj.has(edge.target)) {
      reverseAdj.set(edge.target, []);
    }
    reverseAdj.get(edge.target)!.push(edge.source);
  }

  // Also build forward adjacency (what does this file import?)
  const forwardAdj = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (!forwardAdj.has(edge.source)) {
      forwardAdj.set(edge.source, []);
    }
    forwardAdj.get(edge.source)!.push(edge.target);
  }

  // BFS through reverse edges (find all files that depend on the target)
  const visited = new Set<string>();
  const queue: Array<{ path: string; depth: number }> = [{ path: filePath, depth: 0 }];
  visited.add(filePath);

  const affectedFiles: Array<{ path: string; depth: number; riskLevel: string }> = [];

  // Build node map for risk levels
  const nodeMap = new Map<string, IGraphNode>();
  for (const node of graph.nodes) {
    nodeMap.set(node.id, node);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const dependents = reverseAdj.get(current.path) || [];

    for (const dep of dependents) {
      if (!visited.has(dep)) {
        visited.add(dep);
        const node = nodeMap.get(dep);
        const entry = {
          path: dep,
          depth: current.depth + 1,
          riskLevel: node?.riskLevel || "low",
        };
        affectedFiles.push(entry);
        queue.push(entry);
      }
    }
  }

  // Sort by depth, then by risk level
  const riskOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  affectedFiles.sort((a, b) => {
    if (a.depth !== b.depth) return a.depth - b.depth;
    return (riskOrder[a.riskLevel] || 3) - (riskOrder[b.riskLevel] || 3);
  });

  return {
    affectedFiles,
    totalAffected: affectedFiles.length,
  };
}

/**
 * Get the full dependency graph for a repository (read from DB).
 */
export async function getGraphForRepo(repoId: string) {
  const graph = await DependencyGraph.findOne({ repoId });
  if (!graph) return null;
  return { nodes: graph.nodes, edges: graph.edges };
}
