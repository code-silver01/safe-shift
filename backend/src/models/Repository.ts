import { MemoryRepository } from "../config/memoryStore.js";
export * from "./index.js";
import type { IRepository, IFileEntry } from "./index.js";

export const Repository = {
  create: async (data: Partial<IRepository>): Promise<IRepository> => {
    return MemoryRepository.create(data);
  },

  findById: async (id: string): Promise<(IRepository & { files: IFileEntry[] }) | null> => {
    return MemoryRepository.findById(id);
  },

  findByIdAndUpdate: async (id: string, update: Partial<IRepository & { files?: IFileEntry[] }>): Promise<void> => {
    return MemoryRepository.findByIdAndUpdate(id, update);
  },
};
