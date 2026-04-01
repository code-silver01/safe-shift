/**
 * In-Memory Store — Drop-in replacement for Neo4j
 * Stores repositories, files, graph edges, business tags, and AI logs in RAM.
 * Perfect for local development and demos without any database dependency.
 */

import type { IRepository, IFileEntry, IAILog } from "../models/index.js";
import type { IBusinessRule } from "../models/BusinessTag.js";
import { randomUUID } from "crypto";

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------
interface StoredRepo extends IRepository {
  files: IFileEntry[];
}

const repos = new Map<string, StoredRepo>();
const edges = new Map<string, { source: string; target: string }[]>(); // repoId → edges
const businessTags = new Map<string, IBusinessRule[]>(); // repoId → rules
const aiLogs = new Map<string, IAILog[]>(); // repoId → logs

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------
export const MemoryRepository = {
  create: async (data: Partial<IRepository>): Promise<IRepository> => {
    const id = randomUUID();
    const now = new Date().toISOString();
    const repo: StoredRepo = {
      id,
      name: data.name || "",
      fullUrl: data.fullUrl || "",
      clonePath: data.clonePath || "",
      status: data.status || "queued",
      statusMessage: data.statusMessage || "",
      progress: data.progress || 0,
      totalFiles: 0,
      totalLines: 0,
      languages: {},
      createdAt: now,
      updatedAt: now,
      files: [],
    };
    repos.set(id, repo);
    edges.set(id, []);
    aiLogs.set(id, []);
    return repo;
  },

  findById: async (id: string): Promise<(IRepository & { files: IFileEntry[] }) | null> => {
    return repos.get(id) || null;
  },

  findByIdAndUpdate: async (
    id: string,
    update: Partial<IRepository & { files?: IFileEntry[] }>
  ): Promise<void> => {
    const repo = repos.get(id);
    if (!repo) return;

    const { files, ...rest } = update;
    Object.assign(repo, rest, { updatedAt: new Date().toISOString() });

    if (files) {
      // Merge new files into existing ones by path
      const fileMap = new Map(repo.files.map((f) => [f.path, f]));
      for (const f of files) {
        fileMap.set(f.path, { ...(fileMap.get(f.path) || {}), ...f } as IFileEntry);
      }
      repo.files = Array.from(fileMap.values());
    }
  },
};

// ---------------------------------------------------------------------------
// Dependency Graph
// ---------------------------------------------------------------------------
export const MemoryGraph = {
  setEdges: (repoId: string, rels: { source: string; target: string }[]) => {
    edges.set(repoId, rels);
  },

  getEdges: (repoId: string) => edges.get(repoId) || [],

  getGraphForRepo: async (repoId: string) => {
    const repo = repos.get(repoId);
    if (!repo) return { nodes: [], edges: [] };

    const repoEdges = edges.get(repoId) || [];
    const nodes = repo.files.map((f) => ({
      id: f.path,
      label: f.path.split("/").pop() || f.path,
      type: f.language,
      lineCount: f.lineCount,
      complexity: f.complexity,
      riskLevel: f.riskLevel || "low",
      dependencyCount: 0,
    }));

    // Compute dependency counts
    const nodeLookup = new Map(nodes.map((n) => [n.id, n]));
    for (const e of repoEdges) {
      if (nodeLookup.has(e.source)) nodeLookup.get(e.source)!.dependencyCount++;
      if (nodeLookup.has(e.target)) nodeLookup.get(e.target)!.dependencyCount++;
    }

    return {
      nodes,
      edges: repoEdges.map((e) => ({ ...e, type: "import" })),
    };
  },

  getBlastRadius: async (repoId: string, filePath: string) => {
    const repoEdges = edges.get(repoId) || [];
    const repo = repos.get(repoId);
    if (!repo) return { affectedFiles: [], totalAffected: 0 };

    // BFS — walk backwards: find all files that import `filePath` (directly or transitively)
    const reverseAdj = new Map<string, string[]>();
    for (const e of repoEdges) {
      if (!reverseAdj.has(e.target)) reverseAdj.set(e.target, []);
      reverseAdj.get(e.target)!.push(e.source);
    }

    const visited = new Map<string, number>(); // path → depth
    const queue: { path: string; depth: number }[] = [{ path: filePath, depth: 0 }];
    visited.set(filePath, 0);

    while (queue.length > 0) {
      const { path, depth } = queue.shift()!;
      const importers = reverseAdj.get(path) || [];
      for (const imp of importers) {
        if (!visited.has(imp)) {
          visited.set(imp, depth + 1);
          queue.push({ path: imp, depth: depth + 1 });
        }
      }
    }

    // Build file risk lookup
    const fileRisk = new Map(repo.files.map((f) => [f.path, f.riskLevel || "low"]));

    const affectedFiles = Array.from(visited.entries())
      .filter(([p]) => p !== filePath)
      .map(([path, depth]) => ({
        path,
        depth,
        riskLevel: fileRisk.get(path) || "low",
      }))
      .sort((a, b) => a.depth - b.depth);

    return { affectedFiles, totalAffected: affectedFiles.length };
  },
};

// ---------------------------------------------------------------------------
// Business Tags
// ---------------------------------------------------------------------------
export const MemoryBusinessTag = {
  findOneAndUpdate: async (
    query: { repoId: string },
    data: { repoId: string; rules: IBusinessRule[] }
  ): Promise<void> => {
    businessTags.set(query.repoId, data.rules);
  },

  findOne: async (query: { repoId: string }): Promise<{ rules: IBusinessRule[] } | null> => {
    const rules = businessTags.get(query.repoId);
    return rules ? { rules } : null;
  },
};

// ---------------------------------------------------------------------------
// AI Logs
// ---------------------------------------------------------------------------
export const MemoryAILog = {
  create: async (data: Partial<IAILog>): Promise<IAILog> => {
    const log: IAILog = {
      id: randomUUID(),
      repoId: data.repoId || "",
      filePath: data.filePath || "",
      prompt: data.prompt || "",
      response: data.response || "",
      complexityScore: data.complexityScore || 0,
      complexityTier: data.complexityTier || "low",
      modelUsed: data.modelUsed || "",
      modelId: data.modelId || "",
      inputTokens: data.inputTokens || 0,
      outputTokens: data.outputTokens || 0,
      costUSD: data.costUSD || 0,
      premiumCostUSD: data.premiumCostUSD || 0,
      savingsUSD: data.savingsUSD || 0,
      latencyMs: data.latencyMs || 0,
      timestamp: new Date().toISOString(),
    };

    if (!aiLogs.has(log.repoId)) aiLogs.set(log.repoId, []);
    aiLogs.get(log.repoId)!.push(log);
    return log;
  },

  find: async (query: { repoId: string }): Promise<IAILog[]> => {
    return aiLogs.get(query.repoId) || [];
  },
};
