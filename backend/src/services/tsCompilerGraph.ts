import * as fs from "fs";
import * as path from "path";
import * as ts from "typescript";

// ---------------------------------------------------------------------------
// Type Definitions
// ---------------------------------------------------------------------------
export interface TSGraphNode {
  id: string; // Relative path, e.g., "src/index.ts"
  label: string; // e.g., "index.ts"
  inDegree: number;
  outDegree: number;
  community: "frontend" | "backend" | "shared" | "island" | string;
  isEntryPoint: boolean;
  language: "typescript" | "javascript" | "other";
  externalImports: string[]; // e.g., ["react", "express"]
}

export interface TSGraphEdge {
  source: string; // The file doing the importing
  target: string; // The file being imported
  type: "import" | "export";
}

export interface TSGraphResult {
  nodes: TSGraphNode[];
  edges: TSGraphEdge[];
  communities: Record<string, string[]>;
  stats: {
    totalNodes: number;
    totalEdges: number;
    islandCount: number;
    frontendCount: number;
    backendCount: number;
    sharedCount: number;
  };
}

const SUPPORTED_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

// ---------------------------------------------------------------------------
// Engine: Build Custom AST Knowledge Graph
// ---------------------------------------------------------------------------
export function buildTsCompilerGraph(rootDir: string): TSGraphResult {
  const nodes = new Map<string, TSGraphNode>();
  const edges: TSGraphEdge[] = [];
  const edgeSet = new Set<string>();

  // 1. Scan directory for all code files
  const rootFileNames = scanSourceFiles(rootDir);
  const fileSet = new Set(rootFileNames); // Absolute paths

  // Initialize nodes for all discovered files
  for (const absPath of rootFileNames) {
    const relPath = path.relative(rootDir, absPath).replace(/\\/g, "/");
    nodes.set(relPath, {
      id: relPath,
      label: path.basename(relPath),
      inDegree: 0,
      outDegree: 0,
      community: "shared", // Will be overridden
      isEntryPoint: isEntryPoint(relPath),
      language: detectLang(relPath),
      externalImports: [],
    });
  }

  // 2. Parse and Walk AST for every file
  for (const absPath of rootFileNames) {
    const relSourcePath = path.relative(rootDir, absPath).replace(/\\/g, "/");
    const sourceNode = nodes.get(relSourcePath);
    if (!sourceNode) continue;

    const fileContent = fs.readFileSync(absPath, "utf-8");
    const sourceFile = ts.createSourceFile(
      absPath,
      fileContent,
      ts.ScriptTarget.Latest,
      true
    );

    // Recursively walk AST
    ts.forEachChild(sourceFile, function visit(node: ts.Node) {
      let importPath = "";

      // ── Detect static import/export (ES6) ─────────────────────────
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        importPath = node.moduleSpecifier.text;
      }
      // ── Detect dynamic import() or require() (CommonJS) ───────────
      else if (
        ts.isCallExpression(node) &&
        node.arguments.length > 0 &&
        ts.isStringLiteral(node.arguments[0])
      ) {
        const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
        const isRequire = ts.isIdentifier(node.expression) && node.expression.text === "require";
        
        if (isDynamicImport || isRequire) {
          importPath = (node.arguments[0] as ts.StringLiteral).text;
        }
      }

      // Process discovered importPath
      if (importPath) {
        // Handle Vite/Webpack path aliases (like @/components/...)
        const isViteAlias = importPath.startsWith("@/");
        
        if (!isViteAlias && !importPath.startsWith(".") && !importPath.startsWith("/")) {
          // It's an external library (npm package)
          const pkgName = importPath.startsWith("@")
            ? importPath.split("/").slice(0, 2).join("/")
            : importPath.split("/")[0];
          
          if (!sourceNode.externalImports.includes(pkgName)) {
            sourceNode.externalImports.push(pkgName);
          }
        } else {
          // It's a local file. We must resolve it to an absolute path.
          let effectiveImportPath = importPath;
          if (isViteAlias) {
             // Translate "@/..." -> "src/..." relative to rootDir
             effectiveImportPath = path.resolve(rootDir, importPath.replace("@/", "src/"));
          } else if (importPath.startsWith("/")) {
             // Absolute paths from rootDir (e.g. Next.js or absolute imports)
             effectiveImportPath = path.resolve(rootDir, importPath.substring(1));
          } else {
             // Traditional relative paths (./ or ../)
             effectiveImportPath = path.resolve(path.dirname(absPath), importPath);
          }

          const resolvedRelPath = resolveLocalImport(rootDir, effectiveImportPath, nodes);
          
          if (resolvedRelPath) {
            const relTargetPath = resolvedRelPath;
            
            // Only map edges to nodes within our tracked repository boundary
            if (relSourcePath !== relTargetPath) {
              const edgeKey = `${relSourcePath}→${relTargetPath}`;
              if (!edgeSet.has(edgeKey)) {
                edgeSet.add(edgeKey);
                edges.push({
                  source: relSourcePath,
                  target: relTargetPath,
                  type: ts.isExportDeclaration(node) ? "export" : "import",
                });
                
                // Update Degrees
                sourceNode.outDegree++;
                nodes.get(relTargetPath)!.inDegree++;
              }
            }
          }
        }
      }

      ts.forEachChild(node, visit);
    });
  }

  const nodesArray = Array.from(nodes.values());

  // 3. Simple Graph Analysis (Communities & Islands)
  let islandCount = 0;
  let frontendCount = 0;
  let backendCount = 0;
  let sharedCount = 0;
  const communities: Record<string, string[]> = {
    frontend: [],
    backend: [],
    shared: [],
    island: [],
  };

  for (const node of nodesArray) {
    if (node.inDegree === 0 && !node.isEntryPoint) {
      node.community = "island";
      islandCount++;
      communities.island.push(node.id);
    } else {
      const isFrontend = node.id.includes("components") || node.id.includes("views") || node.id.includes("pages") || node.language === "typescript";
      const isBackend = node.id.includes("controllers") || node.id.includes("routes") || node.id.includes("models") || node.externalImports.includes("express");
      
      if (isFrontend && !isBackend) {
        node.community = "frontend";
        frontendCount++;
        communities.frontend.push(node.id);
      } else if (isBackend && !isFrontend) {
        node.community = "backend";
        backendCount++;
        communities.backend.push(node.id);
      } else {
        node.community = "shared";
        sharedCount++;
        communities.shared.push(node.id);
      }
    }
  }

  // 4. Cleanup Memory and Output payload
  return {
    nodes: nodesArray,
    edges,
    communities,
    stats: {
      totalNodes: nodesArray.length,
      totalEdges: edges.length,
      islandCount,
      frontendCount,
      backendCount,
      sharedCount,
    },
  };
}

// ---------------------------------------------------------------------------
// Helper: Resolve Local Import Paths aggressively (Windows Safe)
// ---------------------------------------------------------------------------
function resolveLocalImport(rootDir: string, effectiveAbsPath: string, nodes: Map<string, TSGraphNode>): string | null {
  // Use relative path to avoid Windows drive letter case mismatch (C:\ vs c:\)
  const relPath = path.relative(rootDir, effectiveAbsPath).replace(/\\/g, "/");

  // 1. Exact match
  if (nodes.has(relPath)) return relPath;

  // 2. Append extensions (e.g., 'utils' -> 'utils.js')
  for (const ext of SUPPORTED_EXTS) {
    if (nodes.has(relPath + ext)) return relPath + ext;
  }

  // 3. Directory import (e.g., 'utils' -> 'utils/index.js')
  for (const ext of SUPPORTED_EXTS) {
    const indexFile = `${relPath}/index${ext}`;
    if (nodes.has(indexFile)) return indexFile;
  }

  return null; // Dead link
}

// ---------------------------------------------------------------------------
// Helper: File Scanner
// ---------------------------------------------------------------------------
function scanSourceFiles(dir: string, results: string[] = []): string[] {
  if (!fs.existsSync(dir)) return results;

  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === "node_modules" || file.startsWith(".") || file === "dist" || file === "build") {
      continue;
    }

    const fullPath = path.join(dir, file);
    try {
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        scanSourceFiles(fullPath, results);
      } else {
        const ext = path.extname(fullPath).toLowerCase();
        if (SUPPORTED_EXTS.has(ext)) {
          results.push(fullPath);
        }
      }
    } catch {
      // Ignore unreadable files
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function detectLang(filePath: string): "typescript" | "javascript" | "other" {
  if (filePath.endsWith(".ts") || filePath.endsWith(".tsx")) return "typescript";
  if (filePath.endsWith(".js") || filePath.endsWith(".jsx") || filePath.endsWith(".cjs") || filePath.endsWith(".mjs")) return "javascript";
  return "other";
}

function isEntryPoint(filePath: string): boolean {
  const name = path.basename(filePath).toLowerCase();
  return (
    name.startsWith("index") ||
    name.startsWith("main") ||
    name.startsWith("app") ||
    name.startsWith("server")
  );
}
