// Define the alias mappings
const aliases = {
    '$lib': '/client',
    '$components': '/client/components',
    '$utils': '/client/utils'
};

// Check if Import Maps are supported
const hasImportMaps = (() => {
    try {
        return HTMLScriptElement.supports && HTMLScriptElement.supports('importmap');
    } catch {
        return false;
    }
})();

// Create a resolver function
export function resolveImportPath(path) {
    for (const [alias, realPath] of Object.entries(aliases)) {
        if (path.startsWith(alias)) {
            return path.replace(alias, realPath);
        }
    }
    return path;
}

// Create an import function that uses the resolver
export async function importModule(path) {
    if (hasImportMaps) {
        // Use Import Maps if supported
        return import(path);
    } else {
        // Fallback to manual path resolution
        const resolvedPath = resolveImportPath(path);
        return import(resolvedPath);
    }
} 