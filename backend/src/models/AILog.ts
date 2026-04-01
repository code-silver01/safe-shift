import { MemoryAILog } from "../config/memoryStore.js";
import type { IAILog } from "./index.js";
export type { IAILog };

export const AILog = {
  create: async (data: Partial<IAILog>): Promise<IAILog> => {
    return MemoryAILog.create(data);
  },

  find: async (query: { repoId: string }): Promise<IAILog[]> => {
    return MemoryAILog.find(query);
  },
};
