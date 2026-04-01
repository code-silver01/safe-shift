import { MemoryBusinessTag } from "../config/memoryStore.js";
import type { IBusinessTag } from "./index.js";
export type { IBusinessTag };

export interface IBusinessRule {
  pathPattern: string;
  businessDomain: string;
  revenueImpact: number;
  trafficShare: number;
  downtimeCostPerMin: number;
  priority: "critical" | "high" | "medium" | "low";
}

export const BusinessTag = {
  findOneAndUpdate: async (query: { repoId: string }, data: { repoId: string; rules: IBusinessRule[] }): Promise<void> => {
    return MemoryBusinessTag.findOneAndUpdate(query, data);
  },

  findOne: async (query: { repoId: string }): Promise<{ rules: IBusinessRule[] } | null> => {
    return MemoryBusinessTag.findOne(query);
  },
};
