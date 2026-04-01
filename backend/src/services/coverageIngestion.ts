// ─────────────────────────────────────────────────────────────────────────────
// Engine 3: Test Coverage Ingestion + Priority Score Calculator
//
// Parses real coverage-final.json (Istanbul/V8/Vitest format) and computes
// per-file priority scores: P = Complexity / (Coverage + 0.01) + 1
// ─────────────────────────────────────────────────────────────────────────────

export interface FileCoverageData {
  filePath: string;
  statementCoverage: number;   // 0-100
  functionCoverage: number;    // 0-100
  branchCoverage: number;      // 0-100
  lineCoverage: number;        // 0-100
  overallCoverage: number;     // weighted average 0-100
}

export interface PriorityScore {
  filePath: string;
  fileName: string;
  complexity: number;
  coverage: number;           // 0-100
  priorityScore: number;      // P = Complexity / (Coverage + 0.01) + 1
  riskLevel: "critical" | "high" | "medium" | "low";
}

// ─────────────────────────────────────────────────────────────────────────────
// Parser: coverage-final.json → per-file coverage percentages
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse Istanbul/Vitest coverage-final.json.
 *
 * Expected format (Istanbul/nyc):
 * {
 *   "/absolute/path/src/App.tsx": {
 *     "s": { "0": 5, "1": 0, "2": 3 },   // statement hit counts
 *     "f": { "0": 2, "1": 0 },            // function hit counts
 *     "b": { "0": [1, 0], "1": [5, 2] },  // branch hit counts [then, else]
 *     "statementMap": {...},
 *     "fnMap": {...},
 *     "branchMap": {...}
 *   }
 * }
 *
 * Also supports V8/Vitest format with "lines" field:
 * {
 *   "/path/file.ts": {
 *     "l": { "1": 5, "2": 0, "3": 3 },    // line hit counts
 *     "s": {...}, "f": {...}, "b": {...}
 *   }
 * }
 */
export function parseCoverageFinalJson(
  coverageJson: Record<string, any>,
  projectRoot?: string
): FileCoverageData[] {
  const results: FileCoverageData[] = [];

  for (const [rawPath, fileCov] of Object.entries(coverageJson)) {
    if (!fileCov || typeof fileCov !== "object") continue;

    // Normalize path: strip absolute prefix, normalize to forward slashes
    let filePath = rawPath.replace(/\\/g, "/");
    if (projectRoot) {
      const normalizedRoot = projectRoot.replace(/\\/g, "/");
      if (filePath.startsWith(normalizedRoot)) {
        filePath = filePath.slice(normalizedRoot.length);
      }
    }
    // Strip leading slash
    if (filePath.startsWith("/")) filePath = filePath.slice(1);

    // ── Statement coverage ─────────────────────────────────────────────
    const stmts = fileCov.s || {};
    const stmtValues = Object.values(stmts) as number[];
    const stmtTotal = stmtValues.length;
    const stmtCovered = stmtValues.filter((v) => v > 0).length;
    const statementCoverage =
      stmtTotal > 0 ? (stmtCovered / stmtTotal) * 100 : 0;

    // ── Function coverage ──────────────────────────────────────────────
    const fns = fileCov.f || {};
    const fnValues = Object.values(fns) as number[];
    const fnTotal = fnValues.length;
    const fnCovered = fnValues.filter((v) => v > 0).length;
    const functionCoverage =
      fnTotal > 0 ? (fnCovered / fnTotal) * 100 : 0;

    // ── Branch coverage ────────────────────────────────────────────────
    const branches = fileCov.b || {};
    let branchTotal = 0;
    let branchCovered = 0;
    for (const branchHits of Object.values(branches) as number[][]) {
      if (Array.isArray(branchHits)) {
        for (const hit of branchHits) {
          branchTotal++;
          if (hit > 0) branchCovered++;
        }
      }
    }
    const branchCoverage =
      branchTotal > 0 ? (branchCovered / branchTotal) * 100 : 0;

    // ── Line coverage (uses "l" field if present, else approx from stmts)
    const lines = fileCov.l || {};
    const lineValues = Object.values(lines) as number[];
    const lineTotal = lineValues.length;
    const lineCovered = lineValues.filter((v) => v > 0).length;
    const lineCoverage =
      lineTotal > 0
        ? (lineCovered / lineTotal) * 100
        : statementCoverage; // fallback

    // ── Weighted overall ───────────────────────────────────────────────
    // Statements 40%, Functions 30%, Branches 20%, Lines 10%
    const overallCoverage =
      statementCoverage * 0.4 +
      functionCoverage * 0.3 +
      branchCoverage * 0.2 +
      lineCoverage * 0.1;

    results.push({
      filePath,
      statementCoverage: round2(statementCoverage),
      functionCoverage: round2(functionCoverage),
      branchCoverage: round2(branchCoverage),
      lineCoverage: round2(lineCoverage),
      overallCoverage: round2(overallCoverage),
    });
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Priority Score Calculator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate refactoring priority for each file.
 *
 * Formula:
 *   P = Complexity / (Coverage + 0.01) + 1
 *
 * Why this works:
 *  - High complexity + low coverage → VERY high priority (needs tests & refactoring)
 *  - Low complexity + high coverage → Very low priority (already safe)
 *  - The +0.01 prevents division by zero AND penalizes 0% coverage
 *    (e.g., complexity=10, coverage=0 → P = 10/0.01 + 1 = 1001)
 *  - The +1 ensures priority is always >= 1 (even fully covered simple files)
 *
 * @param complexityMap  Map of filePath → cyclomatic complexity (from staticAnalysis)
 * @param coverageData   Parsed coverage data (from parseCoverageFinalJson)
 * @returns Sorted array of priority scores (highest priority first)
 */
export function calculatePriorityScores(
  complexityMap: Record<string, number>,
  coverageData: FileCoverageData[]
): PriorityScore[] {
  // Build a quick lookup from coverage data
  const coverageMap = new Map<string, number>();
  for (const cov of coverageData) {
    coverageMap.set(cov.filePath, cov.overallCoverage);
  }

  const results: PriorityScore[] = [];

  for (const [filePath, complexity] of Object.entries(complexityMap)) {
    // Coverage is 0-100 percentage. Normalize to 0-1 for the formula
    const coveragePct = coverageMap.get(filePath) ?? 0;
    const coverageNormalized = coveragePct / 100;

    // ── THE CORE FORMULA ───────────────────────────────────────────────
    const priorityScore = complexity / (coverageNormalized + 0.01) + 1;

    // Classify into risk levels for the UI
    let riskLevel: "critical" | "high" | "medium" | "low";
    if (priorityScore > 100) riskLevel = "critical";
    else if (priorityScore > 30) riskLevel = "high";
    else if (priorityScore > 10) riskLevel = "medium";
    else riskLevel = "low";

    results.push({
      filePath,
      fileName: filePath.split("/").pop() || filePath,
      complexity,
      coverage: round2(coveragePct),
      priorityScore: round2(priorityScore),
      riskLevel,
    });
  }

  // Sort descending by priority score — highest priority (most dangerous) first
  return results.sort((a, b) => b.priorityScore - a.priorityScore);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper to generate a summary of coverage + priority analysis
// ─────────────────────────────────────────────────────────────────────────────

export function generateCoverageSummary(
  coverageData: FileCoverageData[],
  priorityScores: PriorityScore[]
) {
  const totalFiles = coverageData.length;
  const avgCoverage =
    totalFiles > 0
      ? round2(
          coverageData.reduce((s, c) => s + c.overallCoverage, 0) / totalFiles
        )
      : 0;

  const zeroCoverage = coverageData.filter(
    (c) => c.overallCoverage === 0
  ).length;
  const fullCoverage = coverageData.filter(
    (c) => c.overallCoverage >= 95
  ).length;

  const criticalCount = priorityScores.filter(
    (p) => p.riskLevel === "critical"
  ).length;
  const highCount = priorityScores.filter(
    (p) => p.riskLevel === "high"
  ).length;

  return {
    totalFiles,
    avgCoverage,
    zeroCoverageFiles: zeroCoverage,
    fullCoverageFiles: fullCoverage,
    prioritySummary: {
      critical: criticalCount,
      high: highCount,
      medium: priorityScores.filter((p) => p.riskLevel === "medium").length,
      low: priorityScores.filter((p) => p.riskLevel === "low").length,
    },
    // Top 5 most urgent files to address
    hotspots: priorityScores.slice(0, 5).map((p) => ({
      file: p.fileName,
      path: p.filePath,
      priority: p.priorityScore,
      complexity: p.complexity,
      coverage: p.coverage,
      risk: p.riskLevel,
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
