/**
 * fix-imports.js
 * 
 * A utility script to find and fix problematic import paths in the codebase.
 * Specifically targets relative imports that might resolve incorrectly in the browser.
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

// Regular expressions for finding imports
const RELATIVE_CORE_IMPORT_REGEX = /from\s+['"]\.\.\/(core|components)\/([^'"]+)['"]/g;
const CORE_SELF_IMPORT_REGEX = /from\s+['"]\.\/core\/([^'"]+)['"]/g; // For imports in core files that reference themselves
const ALL_IMPORT_REGEX = /import\s+.*?from\s+['"]([^'"]+)['"]/g;

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

// Check if a file is in the core directory
function isFileInCoreDirectory(filePath) {
  const normalizedPath = filePath.replace(/\\/g, '/');
  return normalizedPath.includes('/core/') && !normalizedPath.includes('/core/core/');
}

// Fix imports in a file
function fixImportsInFile(filePath) {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    let newContent = fileContent;
    let fileModified = false;
    
    // Replace problematic imports from ../core to absolute paths
    newContent = newContent.replace(RELATIVE_CORE_IMPORT_REGEX, (match, dir, rest) => {
      stats.importsFixed++;
      fileModified = true;
      return `from '/client/${dir}/${rest}'`;
    });
    
    // If file is in core directory, fix imports that incorrectly reference ./core/
    if (isFileInCoreDirectory(filePath)) {
      newContent = newContent.replace(CORE_SELF_IMPORT_REGEX, (match, rest) => {
        stats.importsFixed++;
        fileModified = true;
        log(`  Fixed self-reference in core file: ${path.basename(filePath)}`);
        return `from './${rest}'`;
      });
    }
    
    // Log all imports if verbose
    if (VERBOSE) {
      const imports = [];
      let importMatch;
      while ((importMatch = ALL_IMPORT_REGEX.exec(fileContent)) !== null) {
        imports.push(importMatch[1]);
      }
      
      if (imports.length > 0) {
        log(`Found ${imports.length} imports in ${filePath}:`);
        imports.forEach(imp => log(`  - ${imp}`));
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
  log(`Starting import path fixer${DRY_RUN ? ' (DRY RUN)' : ''}`);
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