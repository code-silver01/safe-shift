import { Repository } from "../models/Repository.js";
import { AILog } from "../models/AILog.js";
import { getBlastRadius } from "./dependencyGraph.js";
import {
  invokeModel,
  calculateCost,
  calculatePremiumCost,
  MODEL_TIERS,
  type BedrockResponse,
} from "./bedrockClient.js";

// ---------------------------------------------------------------------------
// Complexity Heuristic — determines which AI tier to use
// ---------------------------------------------------------------------------
interface ComplexityAssessment {
  score: number;
  tier: "low" | "medium" | "high";
  reasoning: string;
}

export function assessComplexity(
  lineCount: number,
  dependencyCount: number,
  cyclomaticComplexity: number,
  promptLength: number
): ComplexityAssessment {
  // Weighted formula
  const lineScore = Math.min(lineCount / 5, 30);          // 0-30 points
  const depScore = Math.min(dependencyCount * 3, 30);      // 0-30 points
  const complexityScore = Math.min(cyclomaticComplexity, 25); // 0-25 points
  const promptScore = Math.min(promptLength / 50, 15);     // 0-15 points

  const total = Math.round(lineScore + depScore + complexityScore + promptScore);

  let tier: "low" | "medium" | "high";
  let reasoning: string;

  if (total < 30) {
    tier = "low";
    reasoning = `Low complexity (score: ${total}). Simple task with few dependencies. Routing to cost-efficient model.`;
  } else if (total < 65) {
    tier = "medium";
    reasoning = `Medium complexity (score: ${total}). Moderate code size and dependencies. Routing to balanced model.`;
  } else {
    tier = "high";
    reasoning = `High complexity (score: ${total}). Large codebase with many dependencies. Routing to premium model for accuracy.`;
  }

  return { score: total, tier, reasoning };
}

// ---------------------------------------------------------------------------
// Select model based on complexity tier
// ---------------------------------------------------------------------------
function selectModel(tier: "low" | "medium" | "high"): { id: string; name: string } {
  const models = MODEL_TIERS[tier === "low" ? "cheap" : tier === "medium" ? "mid" : "premium"];
  // Pick first available model in the tier
  return models[0];
}

// ---------------------------------------------------------------------------
// Build context-enriched system prompt with blast radius
// ---------------------------------------------------------------------------
async function buildSystemPrompt(
  repoId: string,
  filePath: string,
  baseContext: string
): Promise<string> {
  let blastContext = "";

  try {
    const blast = await getBlastRadius(repoId, filePath);
    if (blast.affectedFiles.length > 0) {
      const fileList = blast.affectedFiles
        .slice(0, 10)
        .map((f) => `  - ${f.path} (${f.riskLevel} risk, depth: ${f.depth})`)
        .join("\n");
      blastContext = `\n\nIMPORTANT CONTEXT - Blast Radius Analysis:
The file "${filePath}" has ${blast.totalAffected} downstream dependent(s).
Affected files:
${fileList}
${blast.totalAffected > 10 ? `  ... and ${blast.totalAffected - 10} more` : ""}

When making changes, ensure backwards compatibility with these dependent files.`;
    }
  } catch {
    // No blast radius data available — that's OK
  }

  return `You are SafeShift AI, an intelligent code analysis and refactoring assistant.
You have deep understanding of software architecture, dependencies, and risk management.

${baseContext}${blastContext}

Guidelines:
- Always prioritize backwards compatibility
- Flag any breaking changes explicitly
- Suggest tests for modified code
- Consider the impact on downstream files`;
}

// ---------------------------------------------------------------------------
// Main AI Router — route a prompt to the appropriate model
// ---------------------------------------------------------------------------
export interface AIRouteResult {
  response: string;
  modelName: string;
  modelId: string;
  complexityTier: "low" | "medium" | "high";
  complexityScore: number;
  complexityReasoning: string;
  inputTokens: number;
  outputTokens: number;
  costUSD: number;
  savingsUSD: number;
  latencyMs: number;
}

export async function routePrompt(
  repoId: string,
  filePath: string,
  prompt: string,
  fileContent: string,
  metadata: {
    lineCount: number;
    dependencyCount: number;
    cyclomaticComplexity: number;
  }
): Promise<AIRouteResult> {
  const startTime = Date.now();

  // 1. Assess complexity
  const assessment = assessComplexity(
    metadata.lineCount,
    metadata.dependencyCount,
    metadata.cyclomaticComplexity,
    prompt.length
  );

  // 2. Select model
  const model = selectModel(assessment.tier);

  // 3. Build context-enriched system prompt
  const systemPrompt = await buildSystemPrompt(
    repoId,
    filePath,
    `Current file: ${filePath}\nFile content:\n\`\`\`\n${fileContent.slice(0, 4000)}\n\`\`\``
  );

  // 4. Invoke model
  let bedrockResponse: BedrockResponse;
  try {
    bedrockResponse = await invokeModel(model.id, systemPrompt, prompt);
  } catch (error) {
    // Fallback: try the next tier if primary fails
    console.warn(`[AI Router] Model ${model.id} failed, trying fallback...`, error);
    const fallbackModel = MODEL_TIERS.mid[0]; // fallback to mid-tier
    bedrockResponse = await invokeModel(fallbackModel.id, systemPrompt, prompt);
  }

  const latencyMs = Date.now() - startTime;

  // 5. Calculate costs
  const actualCost = calculateCost(bedrockResponse.modelId, bedrockResponse.inputTokens, bedrockResponse.outputTokens);
  const premiumCost = calculatePremiumCost(bedrockResponse.inputTokens, bedrockResponse.outputTokens);
  const savings = Math.max(0, premiumCost - actualCost);

  // 6. Log to database
  await AILog.create({
    repoId,
    prompt,
    filePath,
    complexityScore: assessment.score,
    complexityTier: assessment.tier,
    modelUsed: model.name,
    modelId: bedrockResponse.modelId,
    inputTokens: bedrockResponse.inputTokens,
    outputTokens: bedrockResponse.outputTokens,
    costUSD: actualCost,
    premiumCostUSD: premiumCost,
    savingsUSD: savings,
    response: bedrockResponse.text,
    latencyMs,
  });

  return {
    response: bedrockResponse.text,
    modelName: model.name,
    modelId: bedrockResponse.modelId,
    complexityTier: assessment.tier,
    complexityScore: assessment.score,
    complexityReasoning: assessment.reasoning,
    inputTokens: bedrockResponse.inputTokens,
    outputTokens: bedrockResponse.outputTokens,
    costUSD: actualCost,
    savingsUSD: savings,
    latencyMs,
  };
}
