import { Repository, type IFileEntry } from "../models/Repository.js";
import { createRequire } from "module";

// CJS interop for typhonjs-escomplex
const require = createRequire(import.meta.url);

// ---------------------------------------------------------------------------
// Cyclomatic Complexity (simplified heuristic-based calculation)
// ---------------------------------------------------------------------------
// We count decision points in the source code. Each of these adds 1 to complexity:
//   if, else if, else, for, while, do, switch, case, catch, &&, ||, ?, ??

const DECISION_PATTERNS = [
  /\bif\s*\(/g,
  /\belse\s+if\s*\(/g,
  /\bfor\s*\(/g,
  /\bwhile\s*\(/g,
  /\bdo\s*\{/g,
  /\bswitch\s*\(/g,
  /\bcase\s+/g,
  /\bcatch\s*\(/g,
  /\?\?/g,            // nullish coalescing
  /\?\s*[^:?\s]/g,    // ternary (approximate)
];

// Count &&, || separately (logical operators add branches)
const LOGICAL_OPS = [
  /&&/g,
  /\|\|/g,
];

/**
 * Calculate cyclomatic complexity using typhonjs-escomplex (McCabe's method).
 * Falls back to regex heuristic if escomplex fails on exotic syntax.
 */
export function calculateComplexity(source: string): number {
  try {
    const escomplex = require("typhonjs-escomplex");
    const report = escomplex.analyzeModule(source, {
      newmi: false,
      skipCalculation: false,
    });
    const cyclomatic = report?.aggregate?.cyclomatic;
    if (typeof cyclomatic === "number" && cyclomatic >= 1) {
      return Math.round(cyclomatic);
    }
    return calculateComplexityFallback(source);
  } catch {
    // escomplex can fail on TypeScript-specific syntax, JSX, etc.
    return calculateComplexityFallback(source);
  }
}

/**
 * Fallback: regex-based complexity heuristic (the original implementation).
 * Used when escomplex can't parse the file.
 */
function calculateComplexityFallback(source: string): number {
  const stripped = source
    .replace(/\/\/.*$/gm, "")           // line comments
    .replace(/\/\*[\s\S]*?\*\//g, "")   // block comments
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')   // double-quoted strings
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")   // single-quoted strings
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');  // template literals

  let complexity = 1; // base complexity

  for (const pattern of DECISION_PATTERNS) {
    const matches = stripped.match(pattern);
    if (matches) complexity += matches.length;
  }

  for (const pattern of LOGICAL_OPS) {
    const matches = stripped.match(pattern);
    if (matches) complexity += matches.length;
  }

  return complexity;
}

// ---------------------------------------------------------------------------
// Test Coverage Estimation
// ---------------------------------------------------------------------------
// Heuristic: check if there's a corresponding test file in the repo
// and estimate coverage based on test-to-source function ratio.

export function estimateTestCoverage(
  file: IFileEntry,
  allFiles: IFileEntry[]
): number {
  // If this IS a test file, coverage is N/A
  if (file.hasTests) return 100;

  const filePath = file.path.toLowerCase().replace(/\\/g, "/");
  const fileName = filePath.split("/").pop() || "";
  let baseName = fileName.replace(/\.(js|jsx|ts|tsx|mjs|cjs)$/, "");

  // If the file is 'index', use its parent folder name instead
  if (baseName === "index" && filePath.includes("/")) {
    const parts = filePath.split("/");
    baseName = parts[parts.length - 2] || "index";
  }

  // Strategy 1: Co-located test files (e.g. router.test.js, router.spec.ts)
  const strategy1 = allFiles.filter((f) => {
    const testPath = f.path.toLowerCase().replace(/\\/g, "/");
    const testName = testPath.split("/").pop() || "";
    return (
      f.hasTests &&
      (testName.includes(`${baseName}.test.`) ||
        testName.includes(`${baseName}.spec.`) ||
        testName.includes(`${baseName}.tests.`))
    );
  });

  // Strategy 2: Mirror Path Strategy (highly effective for Express/React)
  // e.g. lib/router.js -> test/router.js or test/lib/router.js
  const strategy2 = allFiles.filter((f) => {
    if (!f.hasTests) return false;
    const testPath = f.path.toLowerCase().replace(/\\/g, "/");
    
    // Check if test path contains the relative source path structure
    const sourceSuffix = filePath.includes("/") ? filePath.split("/").slice(1).join("/") : filePath;
    return testPath.includes(sourceSuffix) || testPath.endsWith(fileName);
  });

  // Strategy 3: test/ or __tests__/ directory with fuzzy base name match
  const testDirPattern = /\/(test|tests|__tests__|spec|specs)\/|\\(test|tests|__tests__|spec|specs)\\/i;
  const strategy3 = allFiles.filter((f) => {
    if (!f.hasTests) return false;
    const testPath = f.path.toLowerCase().replace(/\\/g, "/");
    const testFileName = testPath.split("/").pop() || "";
    const testBaseName = testFileName.replace(/\.(js|jsx|ts|tsx|mjs|cjs)$/, "");
    
    const isTestDir = testDirPattern.test(testPath) || testPath.includes("/test/") || testPath.includes("/tests/");
    
    return isTestDir && (testBaseName === baseName || testBaseName.includes(baseName) || baseName.includes(testBaseName));
  });

  // Strategy 4: Directory density fallback
  // If we are in 'lib/' or 'src/' and there are test files in the repo,
  // we assume some level of coverage even if matching fails.
  const isCoreFile = filePath.includes("/lib/") || filePath.includes("/src/") || filePath.startsWith("lib/") || filePath.startsWith("src/");
  
  // Use the best match found
  const testFiles = strategy2.length > 0 ? strategy2 : strategy3.length > 0 ? strategy3 : strategy1;
  
  if (testFiles.length === 0 && isCoreFile) {
    const totalTests = allFiles.filter(f => f.hasTests).length;
    if (totalTests > 0) {
      // Return a "Repo Density" coverage (e.g. 35% if the repo overall has tests)
      return 35;
    }
  }

  if (testFiles.length > 0 && (filePath.includes("router") || filePath.includes("application"))) {
    console.debug(`[COVERAGE] Success! Matched ${testFiles.length} tests for ${filePath}`);
    testFiles.forEach(tf => {
       console.debug(` - Test file functions count: ${tf.functions.length} for ${tf.path}`);
    });
  }

  if (testFiles.length === 0) return 0;

  // Estimate: ratio of test functions to source functions
  const sourceFnCount = Math.max(file.functions.length, 1);
  const testFnCount = testFiles.reduce((sum, tf) => sum + tf.functions.length, 0);

  // Baseline: If we matched test files but they have 0 traditional functions (e.g. they use unknown test formats),
  // assign a baseline coverage of 40% to show that some tests exist.
  if (testFiles.length > 0 && testFnCount === 0) {
    return 40;
  }

  // Heuristic: if test functions >= source functions, assume ~90% coverage
  const ratio = Math.min(testFnCount / sourceFnCount, 1);
  // Floor at 30% if test file exists (we know there IS some coverage)
  return Math.max(Math.round(ratio * 90), 30);
}

// ---------------------------------------------------------------------------
// Risk Score Calculation
// ---------------------------------------------------------------------------
// Formula: riskScore = (complexity * 0.4) + (dependencyCount * 0.3 * 5) - (testCoverage * 0.3)
// Normalized to 0-100 range

export function calculateRiskScore(
  complexity: number,
  dependencyCount: number,
  testCoverage: number
): { score: number; level: "critical" | "high" | "medium" | "low" } {
  // Normalize complexity (cap at 100)
  const normalizedComplexity = Math.min(complexity, 100);

  // Dependency impact (each dep adds ~5 points, capped at 50)
  const depImpact = Math.min(dependencyCount * 5, 50);

  // Coverage benefit (0-30 points of reduction)
  const coverageBenefit = (testCoverage / 100) * 30;

  const raw = (normalizedComplexity * 0.4) + (depImpact * 0.6) - coverageBenefit;
  const score = Math.max(0, Math.min(100, Math.round(raw)));

  let level: "critical" | "high" | "medium" | "low";
  if (score >= 75) level = "critical";
  else if (score >= 50) level = "high";
  else if (score >= 25) level = "medium";
  else level = "low";

  return { score, level };
}

// ---------------------------------------------------------------------------
// Run full static analysis pipeline for a repository
// ---------------------------------------------------------------------------
export async function runStaticAnalysis(repoId: string, fileContents: Map<string, string>): Promise<void> {
  const repo = await Repository.findById(repoId);
  if (!repo) throw new Error(`Repository ${repoId} not found`);

  // First pass: calculate complexity for each file
  const testFilesCount = repo.files.filter(f => f.hasTests).length;
  console.log(`[ANALYSIS] Starting analysis for ${repo.name}. Total files: ${repo.files.length}, Test files: ${testFilesCount}`);

  for (const file of repo.files) {
    const content = fileContents.get(file.path);
    if (content) {
      file.complexity = calculateComplexity(content);
    }
  }

  // Second pass: estimate test coverage
  console.log(`[ANALYSIS] Estimating test coverage...`);
  for (const file of repo.files) {
    if (!file.hasTests) {
      file.testCoverage = estimateTestCoverage(file, repo.files as IFileEntry[]);
    } else {
      file.testCoverage = 100;
    }
  }

  // Third pass: calculate risk scores (needs dependency count from graph)
  // For now, use import count as a proxy for dependency count
  for (const file of repo.files) {
    const depCount = file.imports.length + (file.exports.length > 0 ? 1 : 0);
    const { score, level } = calculateRiskScore(
      file.complexity,
      depCount,
      file.testCoverage
    );
    file.riskScore = score;
    file.riskLevel = level;
  }

  // Only send updated fields over the network to Neo4j to minimize latency and bandwidth
  const updatedFiles = repo.files.map((f) => ({
    path: f.path,
    complexity: f.complexity,
    testCoverage: f.testCoverage,
    hasTests: f.hasTests,
    riskScore: f.riskScore,
    riskLevel: f.riskLevel,
  }));

  await Repository.findByIdAndUpdate(repoId, { files: updatedFiles as any });
}

/**
 * Get aggregated risk metrics for a repository.
 */
export async function getRiskMetrics(repoId: string) {
  const repo = await Repository.findById(repoId);
  if (!repo) throw new Error(`Repository ${repoId} not found`);

  const files = repo.files.filter((f) => !f.hasTests);
  const total = files.length;

  const critical = files.filter((f) => f.riskLevel === "critical").length;
  const high = files.filter((f) => f.riskLevel === "high").length;
  const medium = files.filter((f) => f.riskLevel === "medium").length;
  const low = files.filter((f) => f.riskLevel === "low").length;

  const avgComplexity = total > 0
    ? Math.round(files.reduce((sum, f) => sum + f.complexity, 0) / total)
    : 0;

  const avgCoverage = total > 0
    ? Math.round(files.reduce((sum, f) => sum + f.testCoverage, 0) / total)
    : 0;

  const avgRiskScore = total > 0
    ? Math.round(files.reduce((sum, f) => sum + f.riskScore, 0) / total)
    : 0;

  // Top risk files
  const topRiskFiles = [...files]
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 10)
    .map((f) => ({
      path: f.path,
      name: f.path.split("/").pop(),
      complexity: f.complexity,
      coverage: f.testCoverage,
      riskScore: f.riskScore,
      riskLevel: f.riskLevel,
      imports: f.imports.length,
    }));

  // Chart data for coverage vs complexity
  const chartData = topRiskFiles.map((f) => ({
    service: f.name,
    coverage: f.coverage,
    complexity: f.complexity,
    coupling: f.imports,
    status: f.riskLevel === "critical" ? "Critical" :
            f.riskLevel === "high" ? "High Risk" :
            f.riskLevel === "medium" ? "Medium" : "Low",
  }));

  return {
    summary: {
      totalFiles: total,
      critical,
      high,
      medium,
      low,
      avgComplexity,
      avgCoverage,
      avgRiskScore,
    },
    topRiskFiles,
    chartData,
  };
}
