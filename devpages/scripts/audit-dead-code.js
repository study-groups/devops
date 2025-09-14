#!/usr/bin/env node

/**
 * audit-dead-code.js - Finds unused exports and orphaned files
 * 
 * Keeps codebase lean by identifying code that can be safely removed
 */

import fs from 'fs';
import path from 'path';

// Find all exports in a file
function findExports(content, filePath) {
    const exports = new Set();
    
    // Named exports: export { foo, bar }
    const namedExports = content.matchAll(/export\s*{\s*([^}]+)\s*}/g);
    for (const match of namedExports) {
        const names = match[1].split(',').map(n => n.trim().split(' as ')[0]);
        names.forEach(name => exports.add(name));
    }
    
    // Direct exports: export const foo = ...
    const directExports = content.matchAll(/export\s+(const|let|var|function|class)\s+(\w+)/g);
    for (const match of directExports) {
        exports.add(match[2]);
    }
    
    // Default export
    if (content.includes('export default')) {
        exports.add('default');
    }
    
    return exports;
}

// Find all imports in a file
function findImports(content) {
    const imports = new Map(); // path -> Set of imported names
    
    const importMatches = content.matchAll(/import\s+(?:(\w+)|{\s*([^}]+)\s*}|(\w+)\s*,\s*{\s*([^}]+)\s*})\s+from\s+['"]([^'"]+)['"]/g);
    
    for (const match of importMatches) {
        const [, defaultImport, namedImports, defaultWithNamed, namedWithDefault, importPath] = match;
        
        if (!imports.has(importPath)) {
            imports.set(importPath, new Set());
        }
        
        if (defaultImport) {
            imports.get(importPath).add('default');
        }
        
        if (defaultWithNamed) {
            imports.get(importPath).add('default');
        }
        
        const namedList = namedImports || namedWithDefault || '';
        if (namedList) {
            const names = namedList.split(',').map(n => n.trim().split(' as ')[0]);
            names.forEach(name => imports.get(importPath).add(name));
        }
    }
    
    return imports;
}

// Build export/import maps
function buildCodeMaps(dir) {
    const exports = new Map(); // file -> Set of exports
    const imports = new Map(); // file -> Map of imports
    const allFiles = new Set();
    
    function scanDirectory(currentDir) {
        const items = fs.readdirSync(currentDir);
        
        for (const item of items) {
            const fullPath = path.join(currentDir, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory() && !['node_modules', '.git', 'dist'].includes(item)) {
                scanDirectory(fullPath);
            } else if (item.endsWith('.js') || item.endsWith('.mjs')) {
                const content = fs.readFileSync(fullPath, 'utf8');
                const relativePath = path.relative('./client', fullPath);
                
                allFiles.add(relativePath);
                exports.set(relativePath, findExports(content, relativePath));
                imports.set(relativePath, findImports(content));
            }
        }
    }
    
    scanDirectory(dir);
    return { exports, imports, allFiles };
}

// Find unused exports
function findUnusedExports(exports, imports) {
    const unused = new Map();
    
    for (const [filePath, fileExports] of exports) {
        const unusedInFile = new Set(fileExports);
        
        // Check each import to see if it uses our exports
        for (const [importingFile, fileImports] of imports) {
            for (const [importPath, importedNames] of fileImports) {
                // Resolve relative imports
                let resolvedPath = importPath;
                if (importPath.startsWith('./') || importPath.startsWith('../')) {
                    const importingDir = path.dirname(importingFile);
                    resolvedPath = path.relative('.', path.resolve('./client', importingDir, importPath));
                    resolvedPath = path.relative('./client', resolvedPath);
                }
                
                // Add .js if missing
                if (!resolvedPath.endsWith('.js') && !resolvedPath.includes('/')) {
                    resolvedPath += '.js';
                }
                
                if (resolvedPath === filePath || resolvedPath === filePath.replace(/\.js$/, '')) {
                    // This file is being imported, remove used exports
                    for (const importedName of importedNames) {
                        unusedInFile.delete(importedName);
                    }
                }
            }
        }
        
        if (unusedInFile.size > 0) {
            unused.set(filePath, unusedInFile);
        }
    }
    
    return unused;
}

// Find orphaned files (not imported anywhere)
function findOrphanedFiles(allFiles, imports) {
    const referenced = new Set();
    
    // Add entry points that are always "used"
    const entryPoints = ['index.js', 'bootloader.js', 'main.js'];
    entryPoints.forEach(entry => {
        for (const file of allFiles) {
            if (file.endsWith(entry)) {
                referenced.add(file);
            }
        }
    });
    
    // Mark files that are imported
    for (const [, fileImports] of imports) {
        for (const [importPath] of fileImports) {
            if (importPath.startsWith('./') || importPath.startsWith('../')) {
                // This is a relative import to our codebase
                referenced.add(importPath);
            }
        }
    }
    
    const orphaned = [];
    for (const file of allFiles) {
        if (!referenced.has(file) && !referenced.has(file.replace(/\.js$/, ''))) {
            orphaned.push(file);
        }
    }
    
    return orphaned;
}

// Main audit
function auditDeadCode() {
    console.log('🧹 Auditing dead code...\n');
    
    const { exports, imports, allFiles } = buildCodeMaps('./client');
    const unusedExports = findUnusedExports(exports, imports);
    const orphanedFiles = findOrphanedFiles(allFiles, imports);
    
    let hasIssues = false;
    
    if (unusedExports.size > 0) {
        console.log('❌ Unused exports found:');
        for (const [file, unused] of unusedExports) {
            console.log(`   ${file}: ${Array.from(unused).join(', ')}`);
        }
        console.log();
        hasIssues = true;
    }
    
    if (orphanedFiles.length > 0) {
        console.log('❌ Orphaned files (not imported anywhere):');
        orphanedFiles.forEach(file => console.log(`   ${file}`));
        console.log();
        hasIssues = true;
    }
    
    if (!hasIssues) {
        console.log('✅ No dead code found!');
    } else {
        console.log('💡 Consider removing unused exports and orphaned files');
    }
    
    return !hasIssues;
}

const isClean = auditDeadCode();
process.exit(isClean ? 0 : 1);
