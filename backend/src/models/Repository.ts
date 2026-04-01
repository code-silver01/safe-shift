import { getSession } from "../config/neo4j.js";
export * from "./index.js";
import type { IRepository, IFileEntry } from "./index.js";

// Helper to deserialize repo from Neo4j node
function toRepo(node: any): IRepository {
  const props = node.properties;
  return {
    ...props,
    languages: props.languagesJson ? JSON.parse(props.languagesJson) : {},
  };
}

export const Repository = {
  create: async (data: Partial<IRepository>): Promise<IRepository> => {
    const session = getSession();
    try {
      const result = await session.run(
        `
        CREATE (r:Repository {
          id: randomUUID(),
          name: $title,
          fullUrl: $fullUrl,
          clonePath: $clonePath,
          status: $status,
          statusMessage: $statusMessage,
          progress: $progress,
          totalFiles: 0,
          totalLines: 0,
          languagesJson: "{}",
          createdAt: $now,
          updatedAt: $now
        })
        RETURN r
        `,
        {
          title: data.name || "",
          fullUrl: data.fullUrl || "",
          clonePath: data.clonePath || "",
          status: data.status || "queued",
          statusMessage: data.statusMessage || "",
          progress: data.progress || 0,
          now: new Date().toISOString()
        }
      );
      return toRepo(result.records[0].get("r"));
    } finally {
      await session.close();
    }
  },

  findById: async (id: string): Promise<(IRepository & { files: IFileEntry[] }) | null> => {
    const session = getSession();
    try {
      // Get repo and files
      const result = await session.run(
        `
        MATCH (r:Repository {id: $id})
        OPTIONAL MATCH (r)-[:CONTAINS]->(f:File)
        RETURN r, collect(f) as files
        `,
        { id }
      );
      
      if (result.records.length === 0) return null;
      
      const rNode = result.records[0].get("r");
      if (!rNode) return null;
      
      const repo = toRepo(rNode);
      const fNodes = result.records[0].get("files") || [];
      
      const files = fNodes.filter((n: any) => n !== null).map((f: any) => {
        const p = f.properties;
        return {
          ...p,
          complexity: typeof p.complexity === 'number' ? p.complexity : p.complexity?.toNumber?.() || 0,
          lineCount: typeof p.lineCount === 'number' ? p.lineCount : p.lineCount?.toNumber?.() || 0,
          size: typeof p.size === 'number' ? p.size : p.size?.toNumber?.() || 0,
          testCoverage: typeof p.testCoverage === 'number' ? p.testCoverage : p.testCoverage?.toNumber?.() || 0,
          riskScore: typeof p.riskScore === 'number' ? p.riskScore : p.riskScore?.toNumber?.() || 0,
          hasTests: !!p.hasTests,
          functions: p.functionsJson ? JSON.parse(p.functionsJson) : [],
        };
      });
      
      return { ...repo, files } as any;
    } finally {
      await session.close();
    }
  },

  findByIdAndUpdate: async (id: string, update: Partial<IRepository & { files?: IFileEntry[] }>): Promise<void> => {
    const session = getSession();
    try {
      const { files, ...repoProps } = update;
      let setStatements = [];
      const params: any = { id };
      
      for (const [key, value] of Object.entries(repoProps)) {
        if (key === "languages") {
          setStatements.push(`r.languagesJson = $languagesJson`);
          params.languagesJson = JSON.stringify(value);
        } else if (value !== undefined) {
          setStatements.push(`r.${key} = $${key}`);
          params[key] = value;
        }
      }
      setStatements.push(`r.updatedAt = $updatedAtStr`);
      params.updatedAtStr = new Date().toISOString();
      
      if (setStatements.length > 0) {
        await session.run(`MATCH (r:Repository {id: $id}) SET ${setStatements.join(", ")}`, params);
      }
      
      // If updating files entirely
      if (files) {
        // Prepare files for UNWIND
        const fileData = files.map(f => {
          const result: any = { path: f.path };
          if (f.language !== undefined) result.language = f.language;
          if (f.lineCount !== undefined) result.lineCount = f.lineCount;
          if (f.size !== undefined) result.size = f.size;
          if (f.imports !== undefined) result.imports = f.imports;
          if (f.exports !== undefined) result.exports = f.exports;
          if (f.complexity !== undefined) result.complexity = f.complexity;
          if (f.testCoverage !== undefined) result.testCoverage = f.testCoverage;
          if (f.hasTests !== undefined) result.hasTests = f.hasTests;
          if (f.riskScore !== undefined) result.riskScore = f.riskScore;
          if (f.riskLevel !== undefined) result.riskLevel = f.riskLevel;
          if (f.functions) result.functionsJson = JSON.stringify(f.functions);
          return result;
        });
        
        // This is a bulk merge operation that preserves existing graph edges
        await session.run(
          `
          MATCH (r:Repository {id: $id})
          UNWIND $files AS file
          MERGE (nf:File {repoId: $id, path: file.path})
          SET nf += file
          MERGE (r)-[:CONTAINS]->(nf)
          `,
          { id, files: fileData }
        );
      }
    } finally {
      await session.close();
    }
  }
};
