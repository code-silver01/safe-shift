import { Repository } from "../models/Repository.js";
import { AILog, type IAILog } from "../models/AILog.js";
import { BusinessTag, type IBusinessRule } from "../models/BusinessTag.js";

// ---------------------------------------------------------------------------
// Default business domain tagging heuristics
// ---------------------------------------------------------------------------
const DEFAULT_TAG_RULES: Array<{
  patterns: string[];
  domain: string;
  priority: IBusinessRule["priority"];
  revenueImpact: number;
  trafficShare: number;
  downtimeCostPerMin: number;
}> = [
  {
    patterns: ["payment", "checkout", "billing", "stripe", "paypal", "invoice"],
    domain: "Revenue-Critical",
    priority: "critical",
    revenueImpact: 2400000,  // $2.4M
    trafficShare: 35,
    downtimeCostPerMin: 4000,
  },
  {
    patterns: ["auth", "login", "session", "token", "oauth", "passport", "jwt"],
    domain: "Authentication",
    priority: "critical",
    revenueImpact: 1800000,
    trafficShare: 60,
    downtimeCostPerMin: 3000,
  },
  {
    patterns: ["user", "profile", "account", "registration"],
    domain: "User Management",
    priority: "high",
    revenueImpact: 900000,
    trafficShare: 40,
    downtimeCostPerMin: 1500,
  },
  {
    patterns: ["api", "route", "controller", "middleware", "handler"],
    domain: "API Layer",
    priority: "high",
    revenueImpact: 1200000,
    trafficShare: 80,
    downtimeCostPerMin: 2000,
  },
  {
    patterns: ["database", "model", "schema", "migration", "seed"],
    domain: "Data Layer",
    priority: "high",
    revenueImpact: 1500000,
    trafficShare: 70,
    downtimeCostPerMin: 2500,
  },
  {
    patterns: ["notification", "email", "sms", "push", "alert"],
    domain: "Communications",
    priority: "medium",
    revenueImpact: 300000,
    trafficShare: 20,
    downtimeCostPerMin: 500,
  },
  {
    patterns: ["analytics", "tracking", "metrics", "log", "monitor"],
    domain: "Analytics",
    priority: "low",
    revenueImpact: 100000,
    trafficShare: 10,
    downtimeCostPerMin: 200,
  },
  {
    patterns: ["util", "helper", "lib", "common", "shared", "config"],
    domain: "Infrastructure",
    priority: "medium",
    revenueImpact: 500000,
    trafficShare: 50,
    downtimeCostPerMin: 800,
  },
];

/**
 * Auto-tag file paths based on naming heuristics.
 */
function matchDomain(filePath: string): {
  domain: string;
  priority: IBusinessRule["priority"];
  revenueImpact: number;
  trafficShare: number;
  downtimeCostPerMin: number;
} | null {
  const lower = filePath.toLowerCase();
  for (const rule of DEFAULT_TAG_RULES) {
    if (rule.patterns.some((p) => lower.includes(p))) {
      return {
        domain: rule.domain,
        priority: rule.priority,
        revenueImpact: rule.revenueImpact,
        trafficShare: rule.trafficShare,
        downtimeCostPerMin: rule.downtimeCostPerMin,
      };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Auto-generate business tags for a repository
// ---------------------------------------------------------------------------
export async function generateBusinessTags(repoId: string): Promise<void> {
  const repo = await Repository.findById(repoId);
  if (!repo) throw new Error(`Repository ${repoId} not found`);

  const rules: IBusinessRule[] = [];
  const seenDomains = new Set<string>();

  for (const file of repo.files) {
    const match = matchDomain(file.path);
    if (match && !seenDomains.has(`${match.domain}:${file.path}`)) {
      const pathDir = file.path.split("/").slice(0, -1).join("/");
      const pattern = pathDir ? `${pathDir}/**` : file.path;

      if (!seenDomains.has(pattern)) {
        seenDomains.add(pattern);
        rules.push({
          pathPattern: pattern,
          businessDomain: match.domain,
          revenueImpact: match.revenueImpact,
          trafficShare: match.trafficShare,
          downtimeCostPerMin: match.downtimeCostPerMin,
          priority: match.priority,
        });
      }
    }
  }

  await BusinessTag.findOneAndUpdate(
    { repoId: repo._id },
    { repoId: repo._id, rules },
    { upsert: true, new: true }
  );
}

// ---------------------------------------------------------------------------
// Get Business Impact Dashboard Data
// ---------------------------------------------------------------------------
export async function getBusinessImpact(repoId: string) {
  const repo = await Repository.findById(repoId);
  if (!repo) throw new Error(`Repository ${repoId} not found`);

  const tags = await BusinessTag.findOne({ repoId });
  const aiLogs = await AILog.find({ repoId });

  // --- AI Routing Savings ---
  const totalSavings = aiLogs.reduce((sum: number, log: IAILog) => sum + log.savingsUSD, 0);
  const totalCost = aiLogs.reduce((sum: number, log: IAILog) => sum + log.costUSD, 0);
  const totalPremiumCost = aiLogs.reduce((sum: number, log: IAILog) => sum + log.premiumCostUSD, 0);
  const totalPrompts = aiLogs.length;

  // Breakdown by tier
  const tierBreakdown = {
    cheap: aiLogs.filter((l: IAILog) => l.complexityTier === "low").length,
    mid: aiLogs.filter((l: IAILog) => l.complexityTier === "medium").length,
    premium: aiLogs.filter((l: IAILog) => l.complexityTier === "high").length,
  };

  // --- System Risk Exposure ---
  const criticalFiles = repo.files.filter((f: { riskLevel: string }) => f.riskLevel === "critical");
  const highFiles = repo.files.filter((f: { riskLevel: string }) => f.riskLevel === "high");
  const totalSourceFiles = repo.files.filter((f: { hasTests: boolean }) => !f.hasTests).length;
  const riskExposure = totalSourceFiles > 0
    ? Math.round(((criticalFiles.length + highFiles.length) / totalSourceFiles) * 100)
    : 0;

  // --- Critical Path Analysis ---
  const criticalPaths: Array<{
    filePath: string;
    fileName: string;
    domain: string;
    riskLevel: string;
    trafficShare: number;
    revenueImpact: number;
    downtimeCost: number;
  }> = [];

  for (const file of criticalFiles) {
    const match = matchDomain(file.path);
    if (match) {
      criticalPaths.push({
        filePath: file.path,
        fileName: file.path.split("/").pop() || file.path,
        domain: match.domain,
        riskLevel: file.riskLevel,
        trafficShare: match.trafficShare,
        revenueImpact: match.revenueImpact,
        downtimeCost: match.downtimeCostPerMin,
      });
    }
  }

  // --- KPI data ---
  const kpis = {
    aiRoutingSavings: {
      value: totalSavings,
      formatted: `$${totalSavings.toFixed(2)}`,
      change: totalPremiumCost > 0
        ? `${Math.round((totalSavings / totalPremiumCost) * 100)}% saved vs premium-only`
        : "No AI usage yet",
    },
    systemRiskExposure: {
      value: riskExposure,
      formatted: `${riskExposure}%`,
      change: `${criticalFiles.length + highFiles.length} of ${totalSourceFiles} files at risk`,
    },
    modulesAnalyzed: {
      value: totalSourceFiles,
      formatted: `${totalSourceFiles}`,
      change: `${repo.files.length} total files`,
    },
    criticalFixesQueued: {
      value: criticalFiles.length,
      formatted: `${criticalFiles.length}`,
      change: `${highFiles.length} high-risk also flagged`,
    },
  };

  // --- Pie chart data (AI spend by complexity) ---
  const pieData = [
    { name: "Simple → Cheap AI", value: tierBreakdown.cheap },
    { name: "Medium → Mid-tier AI", value: tierBreakdown.mid },
    { name: "Complex → Premium AI", value: tierBreakdown.premium },
  ].filter((d) => d.value > 0);

  // If no AI data yet, show defaults
  if (pieData.length === 0) {
    pieData.push(
      { name: "Simple → Cheap AI", value: 40 },
      { name: "Complex → Premium AI", value: 60 }
    );
  }

  return {
    kpis,
    criticalPaths,
    pieData,
    businessTags: tags?.rules || [],
    aiStats: {
      totalPrompts,
      totalCost,
      totalSavings,
      tierBreakdown,
    },
  };
}
