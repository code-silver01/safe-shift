import { simpleGit, type SimpleGit } from "simple-git";
import fs from "fs/promises";
import path from "path";
import { v4 as uuid } from "uuid";
import { rimraf } from "rimraf";

const WORKSPACE = process.env.WORKSPACE_DIR || "./workspace";

// Supported file extensions for analysis
const SUPPORTED_EXTENSIONS = new Set([
  ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs",
]);

const IGNORE_DIRS = new Set([
  "node_modules", ".git", "dist", "build", ".next", "coverage",
  "__pycache__", ".cache", ".turbo", ".vercel", ".output",
]);

/**
 * Clone a public GitHub repository into a local workspace directory.
 */
export async function cloneRepo(repoIdentifier: string): Promise<{ clonePath: string; fullUrl: string }> {
  // Normalize to full URL
  let fullUrl: string;
  if (repoIdentifier.startsWith("http")) {
    fullUrl = repoIdentifier;
  } else {
    fullUrl = `https://github.com/${repoIdentifier}.git`;
  }

  // Create workspace if not exists
  await fs.mkdir(WORKSPACE, { recursive: true });

  const cloneDir = path.join(WORKSPACE, uuid());
  const git: SimpleGit = simpleGit();

  // Shallow clone (depth 1) to save time and disk
  await git.clone(fullUrl, cloneDir, ["--depth", "1", "--single-branch"]);

  return { clonePath: cloneDir, fullUrl };
}

/**
 * Recursively list all supported source files in a directory.
 */
export async function listSourceFiles(dirPath: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(current: string) {
    const entries = await fs.readdir(current, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!IGNORE_DIRS.has(entry.name) && !entry.name.startsWith(".")) {
          await walk(path.join(current, entry.name));
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (SUPPORTED_EXTENSIONS.has(ext)) {
          results.push(path.join(current, entry.name));
        }
      }
    }
  }

  await walk(dirPath);
  return results;
}

/**
 * Read file content safely.
 */
export async function readFileContent(filePath: string): Promise<string> {
  return fs.readFile(filePath, "utf-8");
}

/**
 * Clean up a cloned repository workspace.
 */
export async function cleanupRepo(clonePath: string): Promise<void> {
  await rimraf(clonePath);
}

/**
 * Get relative path from clone root.
 */
export function getRelativePath(filePath: string, cloneRoot: string): string {
  return path.relative(cloneRoot, filePath).replace(/\\/g, "/");
}

/**
 * Detect language from file extension.
 */
export function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    ".js": "javascript",
    ".jsx": "jsx",
    ".ts": "typescript",
    ".tsx": "tsx",
    ".mjs": "javascript",
    ".cjs": "javascript",
  };
  return map[ext] || "unknown";
}

/**
 * Check if a file is a test file.
 */
export function isTestFile(filePath: string): boolean {
  if (!filePath) return false;
  const normalized = filePath.replace(/\\/g, "/").toLowerCase();
  const baseName = normalized.split("/").pop() || "";

  // Common test directories (including root-level)
  const isTestDir = 
    normalized.startsWith("test/") || 
    normalized.startsWith("tests/") || 
    normalized.startsWith("spec/") || 
    normalized.startsWith("specs/") || 
    normalized.startsWith("__tests__/") ||
    normalized.includes("/test/") || 
    normalized.includes("/tests/") || 
    normalized.includes("/spec/") || 
    normalized.includes("/__tests__/");

  // Common test file extensions/suffixes
  const isTestSuffix = 
    baseName.includes(".test.") || 
    baseName.includes(".spec.") || 
    baseName.includes("_test.") || 
    baseName.includes("_spec.") ||
    baseName.endsWith(".test.js") ||
    baseName.endsWith(".test.ts") ||
    baseName.endsWith(".spec.js") ||
    baseName.endsWith(".spec.ts");

  return isTestDir || isTestSuffix;
}
