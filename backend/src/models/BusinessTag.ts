import { getSession } from "../config/neo4j.js";
import type { IBusinessTag } from "./index.js";
export type { IBusinessTag };

// Kept this for backward compatibility in services
export interface IBusinessRule {
  pathPattern: string;
  businessDomain: string;
  revenueImpact: number;
  trafficShare: number;
  downtimeCostPerMin: number;
  priority: "critical" | "high" | "medium" | "low";
}

export const BusinessTag = {
  findOneAndUpdate: async (query: { repoId: string }, data: { repoId: string, rules: IBusinessRule[] }): Promise<void> => {
    const session = getSession();
    try {
      // Find repo and delete existing tags manually managed in MongoDB
      // Now we just attach them as BusinessTag nodes
      await session.run(
        `
        MATCH (r:Repository {id: $repoId})-[:HAS_BUSINESS_TAG]->(t:BusinessTag)
        DETACH DELETE t
        `,
        { repoId: query.repoId }
      );

      // Create new tags
      await session.run(
        `
        MATCH (r:Repository {id: $repoId})
        UNWIND $rules AS rule
        CREATE (t:BusinessTag {
          id: randomUUID(),
          repoId: $repoId,
          pathPattern: rule.pathPattern,
          businessDomain: rule.businessDomain,
          revenueImpact: rule.revenueImpact,
          trafficShare: rule.trafficShare,
          downtimeCostPerMin: rule.downtimeCostPerMin,
          priority: rule.priority
        })
        CREATE (r)-[:HAS_BUSINESS_TAG]->(t)
        `,
        { repoId: query.repoId, rules: data.rules }
      );
    } finally {
      await session.close();
    }
  },

  findOne: async (query: { repoId: string }): Promise<{ rules: IBusinessRule[] } | null> => {
    const session = getSession();
    try {
      const result = await session.run(
        `MATCH (r:Repository {id: $repoId})-[:HAS_BUSINESS_TAG]->(t:BusinessTag) RETURN collect(t) as tags`,
        { repoId: query.repoId }
      );
      
      const tagsNode = result.records[0]?.get("tags");
      if (!tagsNode || tagsNode.length === 0) return null;
      
      const rules = tagsNode.map((n: any) => {
        const p = n.properties;
        return {
          pathPattern: p.pathPattern,
          businessDomain: p.businessDomain,
          revenueImpact: typeof p.revenueImpact === 'number' ? p.revenueImpact : p.revenueImpact?.toNumber?.() || 0,
          trafficShare: typeof p.trafficShare === 'number' ? p.trafficShare : p.trafficShare?.toNumber?.() || 0,
          downtimeCostPerMin: typeof p.downtimeCostPerMin === 'number' ? p.downtimeCostPerMin : p.downtimeCostPerMin?.toNumber?.() || 0,
          priority: p.priority,
        };
      });
      
      return { rules };
    } finally {
      await session.close();
    }
  }
};
