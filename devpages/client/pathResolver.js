/**
 * pathResolver.js - Utility for resolving Vite path aliases in the browser
 * 
 * This module helps bridge the gap between development with Vite aliases
 * and runtime execution in the browser.
 */

// Map of Vite aliases to browser-compatible paths
const aliasMap = {
  '$lib/': './',
  '$components/': './components/',
  '$utils/': './utils/'
};

// List of base paths to try, in order of preference
const basePaths = [
  './', // Relative to current directory
  '/client/', // Absolute from web root
  '/', // Web root
  // Add more if needed
];

// Cache of known good paths
const pathCache = new Map();

/**
 * Resolves a path with potential Vite aliases to a browser-compatible path
 * @param {string} path - Path that might contain Vite aliases
 * @returns {string} Browser-compatible path
 */
export function resolvePath(path) {
  let result = path;
  
  // Replace any matching aliases
  for (const [alias, replacement] of Object.entries(aliasMap)) {
    if (result.startsWith(alias)) {
      result = result.replace(alias, replacement);
      break;
    }
  }
  
  return result;
}

/**
 * Checks if a module can be loaded from a given path
 * @param {string} path - Path to test
 * @returns {Promise<boolean>} Whether the module can be loaded
 */
async function canLoadModule(path) {
  try {
    // If we've already determined this path works, skip the check
    if (pathCache.has(path)) {
      return pathCache.get(path);
    }
    
    // Try fetching the file
    const response = await fetch(path);
    const success = response.ok;
    
    // Cache the result
    pathCache.set(path, success);
    
    return success;
  } catch (error) {
    // Cache the failure
    pathCache.set(path, false);
    return false;
  }
}

/**
 * Dynamically imports a module, trying multiple path variations until one works
 * @param {string} originalPath - Module path (can include Vite aliases)
 * @returns {Promise<Module>} Promise for the imported module
 */
export async function importModule(originalPath) {
  // First resolve any aliases
  const resolvedPath = resolvePath(originalPath);
  
  // Extract filename without path
  const filename = resolvedPath.split('/').pop();
  
  // If we have a known best path from diagnostics, try it first
  if (window._bestModulePath) {
    const directoryPath = window._bestModulePath.substring(0, window._bestModulePath.lastIndexOf('/') + 1);
    const combinedPath = directoryPath + filename;
    
    console.log(`[PATH] Trying best known path: ${combinedPath}`);
    
    try {
      return await import(combinedPath);
    } catch (e) {
      console.log(`[PATH] Best path failed, trying alternatives`);
    }
  }
  
  // Try a direct import first
  try {
    console.log(`[PATH] Trying direct import: ${resolvedPath}`);
    return await import(resolvedPath);
  } catch (directError) {
    console.log(`[PATH] Direct import failed: ${directError.message}`);
    
    // Generate all possible variations to try
    const pathVariations = [];
    
    // Add the variations based on basePaths
    for (const basePath of basePaths) {
      // With full path
      pathVariations.push(basePath + resolvedPath.replace(/^[./]+/, ''));
      
      // Just the filename
      if (filename !== resolvedPath) {
        pathVariations.push(basePath + filename);
      }
    }
    
    // Also try absolute from the root
    pathVariations.push('/client/' + filename);
    pathVariations.push('/' + filename);
    
    // Log the variations we're going to try
    console.log(`[PATH] Trying ${pathVariations.length} path variations:`, pathVariations);
    
    // Check which paths are likely to work by fetching them first
    const loadChecks = await Promise.all(
      pathVariations.map(async path => ({ 
        path, 
        canLoad: await canLoadModule(path) 
      }))
    );
    
    // Filter to only paths that can be loaded
    const viablePaths = loadChecks
      .filter(check => check.canLoad)
      .map(check => check.path);
    
    console.log(`[PATH] Found ${viablePaths.length} viable paths:`, viablePaths);
    
    // Try each viable path in sequence
    for (const path of viablePaths) {
      try {
        console.log(`[PATH] Attempting import from: ${path}`);
        const module = await import(path);
        console.log(`[PATH] Successfully imported from: ${path}`);
        
        // Save this as a known good path
        window._bestModulePath = path;
        
        return module;
      } catch (error) {
        console.log(`[PATH] Import failed from ${path}: ${error.message}`);
      }
    }
    
    // If we get here, all paths failed
    throw new Error(`Failed to import module from any path variation: ${originalPath}`);
  }
}

// Make functions available globally
window.resolvePath = resolvePath;
window.importModule = importModule;

// Export a default object for easier imports
export default {
  resolvePath,
  importModule
}; 