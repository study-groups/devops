/**
 * ModuleResolver.js
 *
 * Unified module resolution and dynamic import utility for the client.
 * Handles path aliasing, fallback paths, and robust error handling.
 */

const ALIASES = {
  '$lib': '/client',
  '$components': '/client/components',
  '$utils': '/client/utils',
  '$log': '/client/log',
  '$store': '/client/store',
  '$panels': '/client/panels',
  '$preview': '/client/preview',
  '$settings': '/client/settings',
  '$filesystem': '/client/filesystem',
  '$dom-inspector': '/client/dom-inspector',
};

const BASE_PATHS = ['/client/', './', '/'];
const EXTENSIONS = ['.js', '.mjs'];

const cache = new Map();
const failedCache = new Set();

/**
 * Resolves a module path, applying aliases if present.
 * @param {string} path - The module path (may include alias)
 * @returns {string} - The resolved path
 */
export function resolveModulePath(path) {
  if (cache.has(path)) return cache.get(path);
  if (failedCache.has(path)) throw new Error(`Module resolution failed for: ${path}`);

  let resolved = path;
  for (const [alias, real] of Object.entries(ALIASES)) {
    if (resolved.startsWith(alias)) {
      resolved = resolved.replace(alias, real);
      break;
    }
  }
  // Ensure leading slash for absolute paths
  if (!resolved.startsWith('/') && !resolved.startsWith('./') && !resolved.startsWith('http')) {
    resolved = '/' + resolved;
  }
  cache.set(path, resolved);
  return resolved;
}

/**
 * Dynamically imports a module with alias and fallback support.
 * @param {string} path - The module path (may include alias)
 * @param {Object} options - { retries, retryDelay, validateModule, fallbackPaths }
 * @returns {Promise<Module>} - The imported module
 */
export async function importModule(path, options = {}) {
  const {
    retries = 3,
    retryDelay = 100,
    validateModule = null,
    fallbackPaths = [],
  } = options;

  const resolvedPath = resolveModulePath(path);
  const allPaths = [resolvedPath, ...fallbackPaths];

  for (let attempt = 0; attempt < retries; attempt++) {
    for (const tryPath of allPaths) {
      try {
        // Try direct import
        const module = await import(/* @vite-ignore */ tryPath);
        if (validateModule && !validateModule(module)) {
          throw new Error(`Module validation failed for: ${tryPath}`);
        }
        return module;
      } catch (error) {
        // Try with extensions
        for (const ext of EXTENSIONS) {
          if (ext && !tryPath.endsWith(ext)) {
            try {
              const pathWithExt = tryPath + ext;
              const module = await import(/* @vite-ignore */ pathWithExt);
              if (validateModule && !validateModule(module)) {
                throw new Error(`Module validation failed for: ${pathWithExt}`);
              }
              return module;
            } catch (extError) {
              // Continue
            }
          }
        }
      }
    }
    // Wait before retry
    if (attempt < retries - 1) {
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
  failedCache.add(path);
  throw new Error(`Failed to import module after ${retries} attempts: ${path}`);
}

export function clearModuleCache() {
  cache.clear();
  failedCache.clear();
}

export function getCacheStats() {
  return {
    cached: cache.size,
    failed: failedCache.size,
    total: cache.size + failedCache.size,
  };
} 