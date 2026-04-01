import * as babelParser from "@babel/parser";
import _traverse from "@babel/traverse";
import type { IFileEntry, IFunction } from "../models/Repository.js";
import { detectLanguage, isTestFile } from "./gitService.js";
import path from "path";

// Handle ESM/CJS interop for @babel/traverse
const traverse = (typeof _traverse === "function" ? _traverse : (_traverse as any).default) as typeof _traverse;

// ---------------------------------------------------------------------------
// Babel parser options — handles JS, JSX, TS, TSX
// ---------------------------------------------------------------------------
function getParserPlugins(language: string): babelParser.ParserPlugin[] {
  const base: babelParser.ParserPlugin[] = [
    "decorators-legacy",
    "classProperties",
    "classPrivateProperties",
    "classPrivateMethods",
    "exportDefaultFrom",
    "exportNamespaceFrom",
    "dynamicImport",
    "optionalChaining",
    "nullishCoalescingOperator",
    "importMeta",
    "topLevelAwait",
  ];

  if (language === "typescript" || language === "tsx") {
    base.push("typescript");
  }
  if (language === "jsx" || language === "tsx") {
    base.push("jsx");
  }
  if (language === "javascript") {
    base.push("jsx"); // Many JS files use JSX without the .jsx ext
  }

  return base;
}

// ---------------------------------------------------------------------------
// Parse a single file and extract structural information
// ---------------------------------------------------------------------------
export function parseFile(
  filePath: string,
  content: string,
  cloneRoot: string
): Omit<IFileEntry, "complexity" | "testCoverage" | "riskScore" | "riskLevel"> {
  const language = detectLanguage(filePath);
  const relativePath = path.relative(cloneRoot, filePath).replace(/\\/g, "/");
  const lines = content.split("\n");

  const imports: string[] = [];
  const exports: string[] = [];
  const functions: IFunction[] = [];

  try {
    const ast = babelParser.parse(content, {
      sourceType: "module",
      allowImportExportEverywhere: true,
      allowReturnOutsideFunction: true,
      allowSuperOutsideMethod: true,
      allowUndeclaredExports: true,
      errorRecovery: true,
      plugins: getParserPlugins(language),
    });

    traverse(ast, {
      // --- Imports ---
      ImportDeclaration({ node }) {
        if (node.source?.value) {
          imports.push(node.source.value);
        }
      },

      // Dynamic imports: import("...")
      CallExpression({ node }) {
        if (
          node.callee.type === "Import" &&
          node.arguments[0]?.type === "StringLiteral"
        ) {
          imports.push(node.arguments[0].value);
        }
        // require("...")
        if (
          node.callee.type === "Identifier" &&
          node.callee.name === "require" &&
          node.arguments[0]?.type === "StringLiteral"
        ) {
          imports.push(node.arguments[0].value);
        }
      },

      // --- Exports ---
      ExportNamedDeclaration({ node }) {
        if (node.declaration) {
          if ("id" in node.declaration && node.declaration.id) {
            exports.push((node.declaration.id as any).name);
          }
          // export const/let/var
          if ("declarations" in node.declaration) {
            for (const decl of (node.declaration as any).declarations || []) {
              if (decl.id?.name) exports.push(decl.id.name);
            }
          }
        }
        // export { x, y }
        for (const spec of node.specifiers || []) {
          if (spec.exported && "name" in spec.exported) {
            exports.push(spec.exported.name);
          }
        }
      },

      ExportDefaultDeclaration() {
        exports.push("default");
      },

      // --- Functions ---
      FunctionDeclaration({ node }) {
        if (node.id?.name && node.loc) {
          functions.push({
            name: node.id.name,
            lineCount: (node.loc.end.line - node.loc.start.line) + 1,
            startLine: node.loc.start.line,
            params: node.params.length,
          });
        }
      },

      // Arrow and function expressions assigned to variables
      VariableDeclarator({ node }) {
        if (
          node.id.type === "Identifier" &&
          node.init &&
          (node.init.type === "ArrowFunctionExpression" || node.init.type === "FunctionExpression") &&
          node.init.loc
        ) {
          functions.push({
            name: node.id.name,
            lineCount: (node.init.loc.end.line - node.init.loc.start.line) + 1,
            startLine: node.init.loc.start.line,
            params: node.init.params.length,
          });
        }
      },

      // Class methods
      ClassMethod({ node }) {
        if (node.key.type === "Identifier" && node.loc) {
          functions.push({
            name: node.key.name,
            lineCount: (node.loc.end.line - node.loc.start.line) + 1,
            startLine: node.loc.start.line,
            params: node.params.length,
          });
        }
      },
    });
  } catch (err) {
    // If parsing fails, we still return what we can
    console.warn(`[AST] Parse warning for ${relativePath}:`, (err as Error).message);
  }

  return {
    path: relativePath,
    language,
    lineCount: lines.length,
    size: Buffer.byteLength(content, "utf-8"),
    imports,
    exports,
    functions,
    hasTests: isTestFile(filePath),
  };
}

/**
 * Resolve a relative import path to a canonical file path.
 * e.g., "./utils" might resolve to "src/utils.ts" or "src/utils/index.ts"
 */
export function resolveImportPath(
  importSource: string,
  importerPath: string,
  allFilePaths: string[]
): string | null {
  // Skip external packages
  if (!importSource.startsWith(".") && !importSource.startsWith("/")) {
    return null;
  }

  const importerDir = path.dirname(importerPath);
  const resolved = path.posix.join(importerDir, importSource);

  // Try exact match, then with extensions, then /index.*
  const candidates = [
    resolved,
    resolved + ".ts",
    resolved + ".tsx",
    resolved + ".js",
    resolved + ".jsx",
    resolved + "/index.ts",
    resolved + "/index.tsx",
    resolved + "/index.js",
    resolved + "/index.jsx",
  ];

  const allPathsSet = new Set(allFilePaths);
  for (const candidate of candidates) {
    // Normalize
    const normalized = candidate.replace(/\\/g, "/");
    if (allPathsSet.has(normalized)) {
      return normalized;
    }
  }

  return null;
}
