import { getSession } from "../config/neo4j.js";
import type { IAILog } from "./index.js";
export type { IAILog };

export const AILog = {
  create: async (data: Partial<IAILog>): Promise<IAILog> => {
    const session = getSession();
    try {
      const result = await session.run(
        `
        MATCH (r:Repository {id: $repoId})
        CREATE (l:AILog {
          id: randomUUID(),
          repoId: $repoId,
          filePath: $filePath,
          prompt: $prompt,
          response: $response,
          complexityScore: $complexityScore,
          complexityTier: $complexityTier,
          modelUsed: $modelUsed,
          modelId: $modelId,
          inputTokens: $inputTokens,
          outputTokens: $outputTokens,
          costUSD: $costUSD,
          premiumCostUSD: $premiumCostUSD,
          savingsUSD: $savingsUSD,
          latencyMs: $latencyMs,
          timestamp: $now
        })
        CREATE (r)-[:HAS_AI_LOG]->(l)
        RETURN l
        `,
        {
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
          now: new Date().toISOString()
        }
      );
      return result.records[0].get("l").properties as IAILog;
    } finally {
      await session.close();
    }
  },

  find: async (query: { repoId: string }): Promise<IAILog[]> => {
    const session = getSession();
    try {
      const result = await session.run(
        `MATCH (r:Repository {id: $repoId})-[:HAS_AI_LOG]->(l:AILog) RETURN l`,
        { repoId: query.repoId }
      );
      return result.records.map(record => {
          const props = record.get("l").properties;
          return {
              ...props,
              inputTokens: typeof props.inputTokens === 'number' ? props.inputTokens : props.inputTokens?.toNumber?.() || 0,
              outputTokens: typeof props.outputTokens === 'number' ? props.outputTokens : props.outputTokens?.toNumber?.() || 0,
              costUSD: typeof props.costUSD === 'number' ? props.costUSD : props.costUSD?.toNumber?.() || 0,
              premiumCostUSD: typeof props.premiumCostUSD === 'number' ? props.premiumCostUSD : props.premiumCostUSD?.toNumber?.() || 0,
              savingsUSD: typeof props.savingsUSD === 'number' ? props.savingsUSD : props.savingsUSD?.toNumber?.() || 0,
              complexityScore: typeof props.complexityScore === 'number' ? props.complexityScore : props.complexityScore?.toNumber?.() || 0,
              latencyMs: typeof props.latencyMs === 'number' ? props.latencyMs : props.latencyMs?.toNumber?.() || 0,
          } as IAILog;
      });
    } finally {
      await session.close();
    }
  }
};
