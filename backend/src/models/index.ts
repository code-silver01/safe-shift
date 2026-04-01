export interface IFunction {
  name: string;
  lineCount: number;
  startLine: number;
  params: number;
}

export interface IFileEntry {
  path: string;
  language: string;
  lineCount: number;
  size: number;
  imports: string[];
  exports: string[];
  functions: IFunction[];
  complexity: number;
  testCoverage: number;
  hasTests: boolean;
  riskScore: number;
  riskLevel: "critical" | "high" | "medium" | "low";
}

export interface IRepository {
  id: string; // The primary ID (using a UUID instead of ObjectId now)
  name: string;
  fullUrl: string;
  clonePath: string;
  status: "queued" | "cloning" | "parsing" | "analyzing" | "building_graph" | "scoring" | "ready" | "error";
  statusMessage: string;
  progress: number;
  totalFiles: number;
  totalLines: number;
  languages: Record<string, number>;
  createdAt: string;
  updatedAt: string;
}

export interface IGraphNode {
  id: string; // the file path
  label: string; // the file name
  type: string; // the language
  lineCount: number;
  complexity: number;
  riskLevel: string;
  dependencyCount: number;
}

export interface IGraphEdge {
  source: string; // file path
  target: string; // file path
  type: "import";
}

export interface IAILog {
  id: string;
  repoId: string;
  filePath: string;
  prompt: string;
  response: string;
  complexityScore: number;
  complexityTier: "low" | "medium" | "high";
  modelUsed: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  costUSD: number;
  premiumCostUSD: number;
  savingsUSD: number;
  latencyMs: number;
  timestamp: string;
}

export interface IBusinessTag {
  id: string;
  repoId: string;
  filePath: string;
  domain: string;
  priority: "critical" | "high" | "medium" | "low";
  downtimeCostPerMinute: number;
  trafficSharePercentage: number;
  revenueImpactRange: number;
}
