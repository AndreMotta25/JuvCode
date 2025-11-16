import fs from "node:fs";
import fsAsync from "node:fs/promises";
import path from "node:path";
import { isIgnored } from "isomorphic-git";
import log from "electron-log";
import { IS_TEST_BUILD } from "../ipc/utils/test_utils";
import { glob } from "glob";
import { AppChatContext } from "../lib/schemas";
import { readSettings } from "@/main/settings";
import { AsyncVirtualFileSystem } from "../../shared/VirtualFilesystem";

const logger = log.scope("utils/codebase");

// File extensions to include in the extraction
const ALLOWED_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".mts",
  ".cts",
  ".css",
  ".html",
  ".md",
  ".astro",
  ".vue",
  ".svelte",
  ".scss",
  ".sass",
  ".less",
  // Oftentimes used as config (e.g. package.json, vercel.json) or data files (e.g. translations)
  ".json",
  // GitHub Actions
  ".yml",
  ".yaml",
  // Needed for Capacitor projects
  ".xml",
  ".plist",
  ".entitlements",
  ".kt",
  ".java",
  ".gradle",
  ".swift",
  // Edge cases
  // https://github.com/dyad-sh/dyad/issues/880
  ".py",
  // https://github.com/dyad-sh/dyad/issues/1221
  ".php",
];

// Directories to always exclude
// Normally these files are excluded by the gitignore, but sometimes
// people don't have their gitignore setup correctly so we want to
// be conservative and never include these directories.
//
// ex: https://github.com/dyad-sh/dyad/issues/727
const EXCLUDED_DIRS = [
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".venv",
  "venv",
];

// Files to always exclude
const EXCLUDED_FILES = ["pnpm-lock.yaml", "package-lock.json"];

// Files to always include, regardless of extension
const ALWAYS_INCLUDE_FILES = [".gitignore"];

// File patterns to always omit (contents will be replaced with a placeholder)
// We don't want to send environment variables to the LLM because they
// are sensitive and users should be configuring them via the UI.
const ALWAYS_OMITTED_FILES = [".env", ".env.local"];

// File patterns to omit (contents will be replaced with a placeholder)
//
// Why are we not using path.join here?
// Because we have already normalized the path to use /.
//
// Note: these files are only omitted when NOT using smart context.
//
// Why do we omit these files when not using smart context?
//
// Because these files are typically low-signal and adding them
// to the context can cause users to much more quickly hit their
// free rate limits.
const OMITTED_FILES = [
  ...ALWAYS_OMITTED_FILES,
  "src/components/ui",
  "eslint.config",
  "tsconfig.json",
  "tsconfig.app.json",
  "tsconfig.node.json",
  "tsconfig.base.json",
  "components.json",
];

// Maximum file size to include (in bytes) - 1MB
const MAX_FILE_SIZE = 1000 * 1024;

// Maximum size for fileContentCache
const MAX_FILE_CACHE_SIZE = 500;

// File content cache with timestamps
type FileCache = {
  content: string;
  mtime: number;
};

// Cache for file contents
const fileContentCache = new Map<string, FileCache>();

// Cache for git ignored paths
const gitIgnoreCache = new Map<string, boolean>();
// Map to store .gitignore file paths and their modification times
const gitIgnoreMtimes = new Map<string, number>();

// Cache for glob pattern results to avoid recalculating
const globPatternCache = new Map<string, {
  files: string[];
  timestamp: number;
}>();

// Cache TTL in milliseconds (5 minutes)
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Check if a path should be ignored based on git ignore rules
 */
async function isGitIgnored(
  filePath: string,
  baseDir: string,
): Promise<boolean> {
  try {
    // Check if any relevant .gitignore has been modified
    // Git checks .gitignore files in the path from the repo root to the file
    let currentDir = baseDir;
    const pathParts = path.relative(baseDir, filePath).split(path.sep);
    let shouldClearCache = false;

    // Check root .gitignore
    const rootGitIgnorePath = path.join(baseDir, ".gitignore");
    try {
      const stats = await fsAsync.stat(rootGitIgnorePath);
      const lastMtime = gitIgnoreMtimes.get(rootGitIgnorePath) || 0;
      if (stats.mtimeMs > lastMtime) {
        gitIgnoreMtimes.set(rootGitIgnorePath, stats.mtimeMs);
        shouldClearCache = true;
      }
    } catch {
      // Root .gitignore might not exist, which is fine
    }

    // Check .gitignore files in parent directories
    for (let i = 0; i < pathParts.length - 1; i++) {
      currentDir = path.join(currentDir, pathParts[i]);
      const gitIgnorePath = path.join(currentDir, ".gitignore");

      try {
        const stats = await fsAsync.stat(gitIgnorePath);
        const lastMtime = gitIgnoreMtimes.get(gitIgnorePath) || 0;
        if (stats.mtimeMs > lastMtime) {
          gitIgnoreMtimes.set(gitIgnorePath, stats.mtimeMs);
          shouldClearCache = true;
        }
      } catch {
        // This directory might not have a .gitignore, which is fine
      }
    }

    // Clear cache if any .gitignore was modified
    if (shouldClearCache) {
      gitIgnoreCache.clear();
    }

    const cacheKey = `${baseDir}:${filePath}`;

    if (gitIgnoreCache.has(cacheKey)) {
      return gitIgnoreCache.get(cacheKey)!;
    }

    const relativePath = path.relative(baseDir, filePath);
    const result = await isIgnored({
      fs,
      dir: baseDir,
      filepath: relativePath,
    });

    gitIgnoreCache.set(cacheKey, result);
    return result;
  } catch (error) {
    logger.error(`Error checking if path is git ignored: ${filePath}`, error);
    return false;
  }
}

/**
 * Read file contents with caching based on last modified time
 */
export async function readFileWithCache(
  filePath: string,
  virtualFileSystem?: AsyncVirtualFileSystem,
): Promise<string | undefined> {
  try {
    // Check virtual filesystem first if provided
    if (virtualFileSystem) {
      const virtualContent = await virtualFileSystem.readFile(filePath);
      if (virtualContent != null) {
        return virtualContent;
      }
    }

    // Get file stats to check the modification time
    const stats = await fsAsync.stat(filePath);
    const currentMtime = stats.mtimeMs;

    // If file is in cache and hasn't been modified, use cached content
    if (fileContentCache.has(filePath)) {
      const cache = fileContentCache.get(filePath)!;
      if (cache.mtime === currentMtime) {
        return cache.content;
      }
    }

    // Read file and update cache
    const rawContent = await fsAsync.readFile(filePath, "utf-8");
    const content = rawContent;
    fileContentCache.set(filePath, {
      content,
      mtime: currentMtime,
    });

    // Manage cache size by clearing oldest entries when it gets too large
    if (fileContentCache.size > MAX_FILE_CACHE_SIZE) {
      // Get the oldest 25% of entries to remove
      const entriesToDelete = Math.ceil(MAX_FILE_CACHE_SIZE * 0.25);
      const keys = Array.from(fileContentCache.keys());

      // Remove oldest entries (first in, first out)
      for (let i = 0; i < entriesToDelete; i++) {
        fileContentCache.delete(keys[i]);
      }
    }

    return content;
  } catch (error) {
    logger.error(`Error reading file: ${filePath}`, error);
    return undefined;
  }
}

/**
 * Recursively walk a directory and collect all relevant files
 */
async function collectFiles(dir: string, baseDir: string): Promise<string[]> {
  const files: string[] = [];

  // Check if directory exists
  try {
    await fsAsync.access(dir);
  } catch {
    // Directory doesn't exist or is not accessible
    return files;
  }

  try {
    // Read directory contents
    const entries = await fsAsync.readdir(dir, { withFileTypes: true });

    // Process entries concurrently
    const promises = entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);

      // Skip excluded directories
      if (entry.isDirectory() && EXCLUDED_DIRS.includes(entry.name)) {
        return;
      }

      // Skip if the entry is git ignored
      if (await isGitIgnored(fullPath, baseDir)) {
        return;
      }

      if (entry.isDirectory()) {
        // Recursively process subdirectories
        const subDirFiles = await collectFiles(fullPath, baseDir);
        files.push(...subDirFiles);
      } else if (entry.isFile()) {
        // Skip excluded files
        if (EXCLUDED_FILES.includes(entry.name)) {
          return;
        }

        // Skip files that are too large
        try {
          const stats = await fsAsync.stat(fullPath);
          if (stats.size > MAX_FILE_SIZE) {
            return;
          }
        } catch (error) {
          logger.error(`Error checking file size: ${fullPath}`, error);
          return;
        }

        // Include all files in the list
        files.push(fullPath);
      }
    });

    await Promise.all(promises);
  } catch (error) {
    logger.error(`Error reading directory ${dir}:`, error);
  }

  return files;
}

/**
 * Optimized version of collectFiles that filters during collection based on glob patterns
 * This avoids the need to collect all files first and then filter
 */
async function collectFilesOptimized(
  dir: string,
  baseDir: string,
  globPatterns?: string[]
): Promise<string[]> {
  const files: string[] = [];

  // Check if directory exists
  try {
    await fsAsync.access(dir);
  } catch {
    // Directory doesn't exist or is not accessible
    return files;
  }

  try {
    // Read directory contents
    const entries = await fsAsync.readdir(dir, { withFileTypes: true });

    // Process entries concurrently
    const promises = entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(baseDir, fullPath);

      // Skip excluded directories
      if (entry.isDirectory() && EXCLUDED_DIRS.includes(entry.name)) {
        return;
      }

      // Skip if the entry is git ignored
      if (await isGitIgnored(fullPath, baseDir)) {
        return;
      }

      if (entry.isDirectory()) {
        // Recursively process subdirectories
        const subDirFiles = await collectFilesOptimized(fullPath, baseDir, globPatterns);
        files.push(...subDirFiles);
      } else if (entry.isFile()) {
        // Skip excluded files
        if (EXCLUDED_FILES.includes(entry.name)) {
          return;
        }

        // Skip files that are too large
        try {
          const stats = await fsAsync.stat(fullPath);
          if (stats.size > MAX_FILE_SIZE) {
            return;
          }
        } catch (error) {
          logger.error(`Error checking file size: ${fullPath}`, error);
          return;
        }

        // Early filtering based on glob patterns if provided
        if (globPatterns && globPatterns.length > 0) {
          const matches = globPatterns.some(pattern => {
            const fullPattern = path.join(baseDir, pattern).replace(/\\/g, "/");
            const filePath = fullPath.replace(/\\/g, "/");
            // Simple glob matching - could be enhanced with proper glob library
            const patternParts = fullPattern.split("*");
            if (patternParts.length === 1) {
              // No wildcard, exact match
              return filePath === fullPattern;
            }
            // Check if file matches the glob pattern
            return patternParts.every(part => filePath.includes(part));
          });
          
          if (!matches) {
            return;
          }
        }

        // Include file if it passes all checks
        files.push(fullPath);
      }
    });

    await Promise.all(promises);
  } catch (error) {
    logger.error(`Error reading directory ${dir}:`, error);
  }

  return files;
}

/**
 * Selective collection that uses only necessary glob patterns
 * This is much more efficient than collecting all files and then filtering
 */
export async function collectFilesSelective(
  appPath: string,
  globPatterns: string[]
): Promise<string[]> {
  // Create cache key based on patterns and app path
  const cacheKey = `${appPath}:${globPatterns.sort().join(",")}`;
  const now = Date.now();
  
  // Check cache first
  const cached = globPatternCache.get(cacheKey);
  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    logger.log(`Cache hit for glob pattern: ${cacheKey}`);
    return cached.files;
  }

  // For selective collection, we directly use glob to find files
  // This is much more efficient than traversing the entire tree
  const allFiles = new Set<string>();
  
  for (const pattern of globPatterns) {
    const fullPattern = createFullGlobPath({
      appPath,
      globPath: pattern,
    });
    
    try {
      const matches = await glob(fullPattern, {
        nodir: true,
        absolute: true,
        ignore: "**/node_modules/**",
      });
      
      matches.forEach((file) => {
        const normalizedFile = path.normalize(file);
        // Filter out excluded files and check file size
        if (!EXCLUDED_FILES.includes(path.basename(normalizedFile))) {
          allFiles.add(normalizedFile);
        }
      });
    } catch (error) {
      logger.warn(`Error matching pattern ${pattern}:`, error);
    }
  }

  const files = Array.from(allFiles);
  
  // Cache the result
  globPatternCache.set(cacheKey, {
    files,
    timestamp: now,
  });

  // Clean old cache entries periodically
  if (globPatternCache.size > 100) {
    const entriesToDelete = Math.ceil(globPatternCache.size * 0.2);
    const keys = Array.from(globPatternCache.keys());
    for (let i = 0; i < entriesToDelete; i++) {
      globPatternCache.delete(keys[i]);
    }
  }

  return files;
}

const OMITTED_FILE_CONTENT = "// File contents excluded from context";

/**
 * Check if file contents should be read based on extension and inclusion rules
 */
function shouldReadFileContents({
  filePath,
  normalizedRelativePath,
}: {
  filePath: string;
  normalizedRelativePath: string;
}): boolean {
  const ext = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath);

  // OMITTED_FILES takes precedence - never read if omitted
  if (
    OMITTED_FILES.some((pattern) => normalizedRelativePath.includes(pattern))
  ) {
    return false;
  }

  // Check if file should be included based on extension or filename
  return (
    ALLOWED_EXTENSIONS.includes(ext) || ALWAYS_INCLUDE_FILES.includes(fileName)
  );
}

function shouldReadFileContentsForSmartContext({
  filePath,
  normalizedRelativePath,
}: {
  filePath: string;
  normalizedRelativePath: string;
}): boolean {
  const ext = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath);

  // ALWAYS__OMITTED_FILES takes precedence - never read if omitted
  if (
    ALWAYS_OMITTED_FILES.some((pattern) =>
      normalizedRelativePath.includes(pattern),
    )
  ) {
    return false;
  }

  // Check if file should be included based on extension or filename
  return (
    ALLOWED_EXTENSIONS.includes(ext) || ALWAYS_INCLUDE_FILES.includes(fileName)
  );
}

/**
 * Format a file for inclusion in the codebase extract
 */
async function formatFile({
  filePath,
  normalizedRelativePath,
  virtualFileSystem,
}: {
  filePath: string;
  normalizedRelativePath: string;
  virtualFileSystem?: AsyncVirtualFileSystem;
}): Promise<string> {
  try {
    // Check if we should read file contents
    if (!shouldReadFileContents({ filePath, normalizedRelativePath })) {
      return `<dyad-file path="${normalizedRelativePath}">
${OMITTED_FILE_CONTENT}
</dyad-file>

`;
    }

    const content = await readFileWithCache(filePath, virtualFileSystem);

    if (content == null) {
      return `<dyad-file path="${normalizedRelativePath}">
// Error reading file
</dyad-file>

`;
    }

    return `<dyad-file path="${normalizedRelativePath}">
${content}
</dyad-file>

`;
  } catch (error) {
    logger.error(`Error reading file: ${filePath}`, error);
    return `<dyad-file path="${normalizedRelativePath}">
// Error reading file: ${error}
</dyad-file>

`;
  }
}

export interface BaseFile {
  path: string;
  focused?: boolean;
  force?: boolean;
}

export interface CodebaseFile extends BaseFile {
  content: string;
}

export interface CodebaseFileReference extends BaseFile {
  fileId: string;
}

/**
 * Extract and format codebase files as a string to be included in prompts
 * @param appPath - Path to the codebase to extract
 * @param virtualFileSystem - Optional virtual filesystem to apply modifications
 * @returns Object containing formatted output and individual files
 */
export async function extractCodebase({
  appPath,
  chatContext,
  virtualFileSystem,
}: {
  appPath: string;
  chatContext: AppChatContext;
  virtualFileSystem?: AsyncVirtualFileSystem;
}): Promise<{
  formattedOutput: string;
  files: CodebaseFile[];
}> {
  const settings = readSettings();
  const isSmartContextEnabled =
    settings?.enableDyadPro && settings?.enableProSmartFilesContextMode;

  try {
    await fsAsync.access(appPath);
  } catch {
    return {
      formattedOutput: `# Error: Directory ${appPath} does not exist or is not accessible`,
      files: [],
    };
  }
  const startTime = Date.now();

  // Collect files from contextPaths and smartContextAutoIncludes
  const { contextPaths, smartContextAutoIncludes, excludePaths } = chatContext;
  
  // Optimize: Only collect files when we have specific patterns
  let files: string[] = [];
  
  if (contextPaths && contextPaths.length > 0) {
    // Use selective collection when we have specific context paths
    const globPatterns = contextPaths.map(p => p.globPath);
    files = await collectFilesSelective(appPath, globPatterns);
  } else if (
    isSmartContextEnabled &&
    smartContextAutoIncludes &&
    smartContextAutoIncludes.length > 0
  ) {
    // Use selective collection for smart context auto-includes
    const globPatterns = smartContextAutoIncludes.map(p => p.globPath);
    files = await collectFilesSelective(appPath, globPatterns);
  } else {
    // Fallback to traditional collection only when no patterns are specified
    files = await collectFiles(appPath, appPath);
  }

  // Apply virtual filesystem modifications if provided
  if (virtualFileSystem) {
    // Filter out deleted files
    const deletedFiles = new Set(
      virtualFileSystem
        .getDeletedFiles()
        .map((relativePath) => path.resolve(appPath, relativePath)),
    );
    files = files.filter((file) => !deletedFiles.has(file));

    // Add virtual files
    const virtualFiles = virtualFileSystem.getVirtualFiles();
    for (const virtualFile of virtualFiles) {
      const absolutePath = path.resolve(appPath, virtualFile.path);
      if (!files.includes(absolutePath)) {
        files.push(absolutePath);
      }
    }
  }

  // Handle exclude paths (this still needs to be done after collection)
  const excludedFiles = new Set<string>();
  if (excludePaths && excludePaths.length > 0) {
    for (const p of excludePaths) {
      const pattern = createFullGlobPath({
        appPath,
        globPath: p.globPath,
      });
      const matches = await glob(pattern, {
        nodir: true,
        absolute: true,
        ignore: "**/node_modules/**",
      });
      matches.forEach((file) => {
        const normalizedFile = path.normalize(file);
        excludedFiles.add(normalizedFile);
      });
    }
    
    // Filter out excluded files (this takes precedence over include paths)
    if (excludedFiles.size > 0) {
      files = files.filter((file) => !excludedFiles.has(path.normalize(file)));
    }
  }

  // Handle auto-include paths (only when using smart context)
  const autoIncludedFiles = new Set<string>();
  if (
    isSmartContextEnabled &&
    smartContextAutoIncludes &&
    smartContextAutoIncludes.length > 0 &&
    (!contextPaths || contextPaths.length === 0)
  ) {
    // If no context paths but we have auto-includes, we need to collect those files
    const autoIncludePatterns = smartContextAutoIncludes.map(p => p.globPath);
    const autoFiles = await collectFilesSelective(appPath, autoIncludePatterns);
    autoFiles.forEach(file => {
      autoIncludedFiles.add(path.normalize(file));
    });
  }

  // Sort files by modification time (oldest first)
  // This is important for cache-ability.
  const sortedFiles = await sortFilesByModificationTime([...new Set(files)]);

  // Format files and collect individual file contents
  const filesArray: CodebaseFile[] = [];
  const formatPromises = sortedFiles.map(async (file) => {
    // Get raw content for the files array
    const normalizedRelativePath = path
      .relative(appPath, file)
      // Why? Normalize Windows-style paths which causes lots of weird issues (e.g. Git commit)
      .split(path.sep)
      .join("/");
    const formattedContent = await formatFile({
      filePath: file,
      normalizedRelativePath,
      virtualFileSystem,
    });

    const isForced = autoIncludedFiles.has(path.normalize(file));

    // Determine file content based on whether we should read it
    let fileContent: string;
    if (
      !shouldReadFileContentsForSmartContext({
        filePath: file,
        normalizedRelativePath,
      })
    ) {
      fileContent = OMITTED_FILE_CONTENT;
    } else {
      const readContent = await readFileWithCache(file, virtualFileSystem);
      fileContent = readContent ?? "// Error reading file";
    }

    filesArray.push({
      path: normalizedRelativePath,
      content: fileContent,
      force: isForced,
    });

    return formattedContent;
  });

  const formattedFiles = await Promise.all(formatPromises);
  const formattedOutput = formattedFiles.join("");

  const endTime = Date.now();
  logger.log("extractCodebase: time taken", endTime - startTime);
  if (IS_TEST_BUILD) {
    // Why? For some reason, file ordering is not stable on Windows.
    // This is a workaround to ensure stable ordering, although
    // ideally we'd like to sort it by modification time which is
    // important for cache-ability.
    filesArray.sort((a, b) => a.path.localeCompare(b.path));
  }
  return {
    formattedOutput,
    files: filesArray,
  };
}

/**
 * Sort files by their modification timestamp (oldest first)
 */
async function sortFilesByModificationTime(files: string[]): Promise<string[]> {
  // Get stats for all files
  const fileStats = await Promise.all(
    files.map(async (file) => {
      try {
        const stats = await fsAsync.stat(file);
        return { file, mtime: stats.mtimeMs };
      } catch (error) {
        // If there's an error getting stats, use current time as fallback
        // This can happen with virtual files, so it's not a big deal.
        logger.warn(`Error getting file stats for ${file}:`, error);
        return { file, mtime: Date.now() };
      }
    }),
  );

  if (IS_TEST_BUILD) {
    // Why? For some reason, file ordering is not stable on Windows.
    // This is a workaround to ensure stable ordering, although
    // ideally we'd like to sort it by modification time which is
    // important for cache-ability.
    return fileStats
      .sort((a, b) => a.file.localeCompare(b.file))
      .map((item) => item.file);
  }
  // Sort by modification time (oldest first)
  return fileStats.sort((a, b) => a.mtime - b.mtime).map((item) => item.file);
}

export function createFullGlobPath({
  appPath,
  globPath,
}: {
  appPath: string;
  globPath: string;
}): string {
  // By default the glob package treats "\" as an escape character.
  // We want the path to use forward slash for all platforms.
  return `${appPath.replace(/\\/g, "/")}/${globPath}`;
}
