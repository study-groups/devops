/**
 * Module loader utility to ensure consistent module loading
 * This helps with dynamic imports and path resolution
 */

// Base URL for all module imports
export const BASE_URL = window.location.origin;

/**
 * Import a module using an absolute path from the server root
 * @param {string} path - Path to the module, starting with /
 * @returns {Promise<Module>} - The imported module
 */
export async function importModule(path) {
    // Ensure path starts with /
    if (!path.startsWith('/')) {
        path = '/' + path;
    }
    
    // Create absolute URL
    const url = new URL(path, BASE_URL).href;
    
    // Log for debugging
    console.log(`[MODULE] Importing: ${url}`);
    
    try {
        // First attempt: Try importing with the constructed URL
        return await import(url);
    } catch (error) {
        console.warn(`[MODULE] Failed to import ${url}: ${error.message}`);
        
        // Second attempt: Try with a relative path
        try {
            // Convert absolute path to relative
            // Remove leading slash and 'client/' if present
            let relativePath = path;
            if (relativePath.startsWith('/')) {
                relativePath = relativePath.substring(1);
            }
            if (relativePath.startsWith('client/')) {
                relativePath = relativePath.substring(7);
            }
            
            // Add proper relative prefix
            relativePath = './' + relativePath;
            
            console.log(`[MODULE] Trying relative import: ${relativePath}`);
            return await import(relativePath);
        } catch (error2) {
            console.warn(`[MODULE] Failed relative import: ${error2.message}`);
            
            // Third attempt: Try with just the filename
            try {
                const parts = path.split('/');
                const filename = parts[parts.length - 1];
                console.log(`[MODULE] Trying filename import: ${filename}`);
                return await import(filename);
            } catch (error3) {
                console.error(`[MODULE] All import attempts failed for ${path}`);
                throw new Error(`Failed to import module: ${path} - ${error.message}`);
            }
        }
    }
}

/**
 * Import a module using a Vite alias
 * This is a fallback for when Vite's alias resolution isn't available
 * @param {string} alias - The alias to resolve (e.g., $log, $components)
 * @param {string} path - The path after the alias
 * @returns {Promise<Module>} - The imported module
 */
export function importAlias(alias, path = '') {
    // Map of aliases to their actual paths
    const aliasMap = {
        '$log': '/client/log',
        '$components': '/client/components',
        '$utils': '/client/utils',
        '$lib': '/client'
    };
    
    // Resolve the alias
    const basePath = aliasMap[alias];
    if (!basePath) {
        throw new Error(`Unknown alias: ${alias}`);
    }
    
    // Combine the base path with the provided path
    let fullPath = basePath;
    if (path) {
        // Ensure path doesn't start with / if we're appending
        if (path.startsWith('/')) {
            path = path.substring(1);
        }
        fullPath = `${basePath}/${path}`;
    }
    
    // Import using the resolved path
    return importModule(fullPath);
}

// Make it available globally for easy access
if (typeof window !== 'undefined') {
    window.importModule = importModule;
    window.importAlias = importAlias;
} 