import { Repository } from "../models/Repository.js";
import { resolveImportPath } from "./astParser.js";
import { getSession } from "../config/neo4j.js";

// ---------------------------------------------------------------------------
// Build dependency graph from parsed repository data by linking Neo4j nodes
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

  // Determine correct links
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

  // Save the links in Neo4j
  const session = getSession();
  try {
    // Delete old links if any
    await session.run(
      `
      MATCH (f:File {repoId: $repoId})-[r:IMPORTS]->()
      DELETE r
      `,
      { repoId }
    );

    // Create new links
    if (relationships.length > 0) {
      await session.run(
        `
        UNWIND $rels AS rel
        MATCH (s:File {repoId: $repoId, path: rel.source})
        MATCH (t:File {repoId: $repoId, path: rel.target})
        MERGE (s)-[:IMPORTS]->(t)
        `,
        { repoId, rels: relationships }
      );
    }
  } finally {
    await session.close();
  }
}

// ---------------------------------------------------------------------------
// Blast Radius: Traverse the graph to find all downstream dependents
// ---------------------------------------------------------------------------
export async function getBlastRadius(
  repoId: string,
  filePath: string
): Promise<{
  affectedFiles: Array<{ path: string; depth: number; riskLevel: string }>;
  totalAffected: number;
}> {
  const session = getSession();
  try {
    // In Neo4j, blast radius is a breeze:
    // If a file changes, all files that import it (directly or transitively) might be affected.
    // So we traverse backwards along the IMPORTS relationships.
    const result = await session.run(
      `
      MATCH path = (affected:File {repoId: $repoId})-[:IMPORTS*1..10]->(target:File {repoId: $repoId, path: $filePath})
      RETURN affected.path AS path,
             length(path) AS depth,
             affected.riskLevel AS riskLevel
      ORDER BY depth ASC
      `,
      { repoId, filePath }
    );

    const affectedMap = new Map<string, { path: string; depth: number; riskLevel: string }>();

    for (const record of result.records) {
      const p = record.get("path");
      const d = record.get("depth");
      const r = record.get("riskLevel");

      // We might discover multiple paths to the same file. Keep the shortest depth.
      const depthNum = typeof d === 'number' ? d : (d.toNumber?.() || 0);
      
      if (!affectedMap.has(p) || affectedMap.get(p)!.depth > depthNum) {
        affectedMap.set(p, { path: p, depth: depthNum, riskLevel: r || "low" });
      }
    }

    const affectedFiles = Array.from(affectedMap.values());
    
    // Sort logic like before: by depth, then risk
    const riskOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    affectedFiles.sort((a, b) => {
      if (a.depth !== b.depth) return a.depth - b.depth;
      return (riskOrder[a.riskLevel] || 3) - (riskOrder[b.riskLevel] || 3);
    });

    return {
      affectedFiles,
      totalAffected: affectedFiles.length,
    };
  } finally {
    await session.close();
  }
}

/**
 * Get the full dependency graph for a repository
 */
export async function getGraphForRepo(repoId: string) {
  const session = getSession();
  try {
    // Get all files and their relationships
    const result = await session.run(
      `
      MATCH (f:File {repoId: $repoId})
      OPTIONAL MATCH (f)-[r:IMPORTS]->(t:File {repoId: $repoId})
      RETURN f, r, t
      `,
      { repoId }
    );

    const nodesMap = new Map<string, any>();
    const edgesMap = new Map<string, any>();

    // We only need to return elements to power the UI.
    // The UI expects IGraphNode and IGraphEdge format.
    for (const record of result.records) {
      const fNode = record.get("f");
      if (!fNode) continue;
      
      const props = fNode.properties;
      const pathStr = props.path;
      
      if (!nodesMap.has(pathStr)) {
        nodesMap.set(pathStr, {
          id: pathStr,
          label: pathStr.split("/").pop() || pathStr,
          type: props.language,
          lineCount: typeof props.lineCount === 'number' ? props.lineCount : (props.lineCount?.toNumber?.() || 0),
          complexity: typeof props.complexity === 'number' ? props.complexity : (props.complexity?.toNumber?.() || 0),
          riskLevel: props.riskLevel || "low",
          dependencyCount: 0, // Will compute from edges
        });
      }

      const rel = record.get("r");
      const target = record.get("t");
      
      if (rel && target) {
        const edgeKey = `${props.path}|${target.properties.path}`;
        if (!edgesMap.has(edgeKey)) {
          edgesMap.set(edgeKey, {
            source: props.path,
            target: target.properties.path,
            type: "import"
          });
        }
      }
    }

    const nodes = Array.from(nodesMap.values());
    const edges = Array.from(edgesMap.values());

    // Update dependency count for the nodes (in/out degree sum approx)
    for (const edge of edges) {
      if (nodesMap.has(edge.source)) nodesMap.get(edge.source).dependencyCount++;
      if (nodesMap.has(edge.target)) nodesMap.get(edge.target).dependencyCount++;
    }

    return { nodes, edges };
  } finally {
    await session.close();
  }
}
