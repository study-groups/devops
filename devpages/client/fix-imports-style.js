/**
 * fix-imports-style.js
 * 
 * A utility script to find and fix incorrect import styles in the codebase.
 * In particular, it focuses on inconsistencies between named and default imports.
 * 
 * Usage: 
 * 1. Run this script with Node.js
 * 2. It will scan files, find problematic imports, and fix them
 */

const fs = require('fs');
const path = require('path');

// Config
const CLIENT_DIR = process.cwd();
const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

// Modules known to use default exports
const DEFAULT_EXPORT_MODULES = [
  'editor.js',
  'auth.js',
  'views.js',
  'fileManager.js',
  'preview.js'
];

// Regular expressions for finding imports
const NAMED_IMPORT_REGEX = /import\s+{\s*([\w\s,]+)\s*}\s+from\s+['"]([^'"]+)['"]/g;
const DEFAULT_IMPORT_REGEX = /import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g;

// Track stats
const stats = {
  filesScanned: 0,
  filesModified: 0,
  importsFixed: 0
};

// Helper to log with timestamps
function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

// Check if a file should be processed
function shouldProcessFile(filePath) {
  return filePath.endsWith('.js') && 
         !filePath.includes('node_modules') && 
         !filePath.includes('dist');
}

// Check if a module uses default exports
function usesDefaultExport(modulePath) {
  return DEFAULT_EXPORT_MODULES.some(module => modulePath.endsWith(module));
}

// Fix imports in a file
function fixImportsInFile(filePath) {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    let newContent = fileContent;
    let fileModified = false;
    
    // Find incorrect named imports of modules that should use default imports
    let match;
    const namedImportMatches = [];
    
    // Reset regex in case it was used previously
    NAMED_IMPORT_REGEX.lastIndex = 0;
    
    while ((match = NAMED_IMPORT_REGEX.exec(fileContent)) !== null) {
      const [fullMatch, importNames, importPath] = match;
      
      // Check if this is a module that should use default export
      if (usesDefaultExport(importPath)) {
        namedImportMatches.push({
          fullMatch,
          importNames: importNames.trim().split(/\s*,\s*/),
          importPath,
          index: match.index
        });
      }
    }
    
    // Process matches in reverse order to avoid breaking indices
    namedImportMatches.sort((a, b) => b.index - a.index);
    
    for (const match of namedImportMatches) {
      // For modules that should use default imports, we need to check what's being imported
      if (match.importNames.includes('editor') || 
          match.importNames.includes('auth') || 
          match.importNames.includes('views') || 
          match.importNames.includes('fileManager') || 
          match.importNames.includes('preview')) {
        
        // Extract the main import name (the one that matches the module name)
        let mainImportName = null;
        if (match.importPath.endsWith('editor.js')) mainImportName = 'editor';
        else if (match.importPath.endsWith('auth.js')) mainImportName = 'auth';
        else if (match.importPath.endsWith('views.js')) mainImportName = 'views';
        else if (match.importPath.endsWith('fileManager.js')) mainImportName = 'fileManager';
        else if (match.importPath.endsWith('preview.js')) mainImportName = 'preview';
        
        if (mainImportName && match.importNames.includes(mainImportName)) {
          // Fix to use default import
          const replacement = `import ${mainImportName} from '${match.importPath}'`;
          newContent = newContent.slice(0, match.index) + replacement + newContent.slice(match.index + match.fullMatch.length);
          
          stats.importsFixed++;
          fileModified = true;
          
          log(`  Fixed import in ${filePath}: ${match.fullMatch} -> ${replacement}`);
        }
      }
    }
    
    if (fileModified) {
      stats.filesModified++;
      log(`Modified imports in: ${filePath}`);
      
      if (!DRY_RUN) {
        fs.writeFileSync(filePath, newContent, 'utf8');
      }
    }
    
    return fileModified;
  } catch (error) {
    log(`Error processing ${filePath}: ${error.message}`);
    return false;
  }
}

// Scan directory recursively
function scanDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      scanDirectory(fullPath);
    } else if (entry.isFile() && shouldProcessFile(fullPath)) {
      stats.filesScanned++;
      fixImportsInFile(fullPath);
    }
  }
}

// Main function
function main() {
  log(`Starting import style fixer${DRY_RUN ? ' (DRY RUN)' : ''}`);
  log(`Working directory: ${CLIENT_DIR}`);
  
  // Scan the client directory
  scanDirectory(CLIENT_DIR);
  
  // Print results
  log('\nResults:');
  log(`- Files scanned: ${stats.filesScanned}`);
  log(`- Files modified: ${stats.filesModified}`);
  log(`- Imports fixed: ${stats.importsFixed}`);
  
  if (DRY_RUN) {
    log('\nThis was a dry run. No files were actually modified.');
    log('Run without --dry-run to apply changes.');
  }
}

// Run the script
main(); 