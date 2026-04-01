const BASE = "/api";

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...opts?.headers },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || body.message || res.statusText);
  }
  return res.json();
}

// Repo
export const analyzeRepo = (repoUrl: string) =>
  request<{ id: string; name: string; status: string }>("/repo/analyze", {
    method: "POST",
    body: JSON.stringify({ repoUrl }),
  });

export const getRepoStatus = (id: string) =>
  request<{
    id: string; name: string; status: string; statusMessage: string;
    progress: number; totalFiles: number; totalLines: number;
    languages: Record<string, number>;
  }>(`/repo/${id}/status`);

export interface FlatFile {
  path: string; language: string; lineCount: number; complexity: number;
  riskLevel: string; riskScore: number; testCoverage: number; hasTests: boolean;
  importCount: number; exportCount: number; functionCount: number;
  functions: { name: string; lineCount: number; startLine: number; params: number }[];
}

export const getRepoFiles = (id: string) =>
  request<{ id: string; name: string; tree: any[]; flatFiles: FlatFile[] }>(`/repo/${id}/files`);

export const getFileContent = (id: string, filePath: string) =>
  request<{ path: string; content: string; language: string; lineCount: number; complexity: number; riskLevel: string }>(
    `/repo/${id}/file-content?filePath=${encodeURIComponent(filePath)}`
  );

// Graph
export const getGraph = (id: string) =>
  request<{ nodes: any[]; edges: any[]; stats: any }>(`/repo/${id}/graph`);

export const simulateBlast = (id: string, filePath: string) =>
  request<{ sourceFile: string; affectedFiles: { path: string; depth: number; riskLevel: string }[]; totalAffected: number }>(
    `/repo/${id}/simulate`, { method: "POST", body: JSON.stringify({ filePath }) }
  );

// Risk
export const getRiskScores = (id: string) =>
  request<{
    summary: { totalFiles: number; critical: number; high: number; medium: number; low: number; avgComplexity: number; avgCoverage: number; avgRiskScore: number };
    topRiskFiles: { path: string; name: string; complexity: number; coverage: number; riskScore: number; riskLevel: string; imports: number }[];
    chartData: { service: string; coverage: number; complexity: number; coupling: number; status: string }[];
  }>(`/repo/${id}/risk-scores`);

// Business
export const getBusinessImpact = (id: string) =>
  request<{
    kpis: Record<string, { value: number; formatted: string; change: string }>;
    criticalPaths: { filePath: string; fileName: string; domain: string; riskLevel: string; trafficShare: number; revenueImpact: number; downtimeCost: number }[];
    pieData: { name: string; value: number }[];
    aiStats: { totalPrompts: number; totalCost: number; totalSavings: number };
  }>(`/repo/${id}/business-impact`);

// AI
export const routePrompt = (repoId: string, filePath: string, prompt: string, fileContent: string) =>
  request<{
    response: string; modelName: string; complexityTier: string;
    complexityScore: number; complexityReasoning: string;
    inputTokens: number; outputTokens: number; costUSD: number; savingsUSD: number;
  }>("/ai/route-prompt", {
    method: "POST",
    body: JSON.stringify({ repoId, filePath, prompt, fileContent }),
  });
