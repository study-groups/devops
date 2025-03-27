/**
 * Fix imports script
 * 
 * This script will help identify and fix imports of auth.js, authService.js, 
 * viewManager.js in the codebase.
 */

const fs = require('fs');
const path = require('path');
const util = require('util');

const readdir = util.promisify(fs.readdir);
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const stat = util.promisify(fs.stat);

// Client directory
const CLIENT_DIR = path.resolve(__dirname);

// Files to skip
const SKIP_FILES = [
  'migration.sh',
  'fix_imports.js',
  'README.md',
  '.disabled'
];

// Import patterns to fix
const IMPORT_PATTERNS = [
  {
    // Match import { something } from './auth.js';
    pattern: /import\s+\{\s*([^}]+)\s*\}\s+from\s+['"](.\/|\.\.\/)+auth\.js['"];?/g,
    replacement: (match, importedSymbols) => {
      // Convert authState to AUTH_STATE if it's the only import
      if (importedSymbols.trim() === 'authState') {
        return `import { AUTH_STATE } from './core/auth.js';\n\n// For backwards compatibility\nconst authState = AUTH_STATE;`;
      }
      
      // If it contains authState along with other symbols, keep both
      if (importedSymbols.includes('authState')) {
        const otherSymbols = importedSymbols
          .split(',')
          .map(s => s.trim())
          .filter(s => s !== 'authState')
          .join(', ');
        
        return `import { AUTH_STATE, ${otherSymbols} } from './core/auth.js';\n\n// For backwards compatibility\nconst authState = AUTH_STATE;`;
      }
      
      // Otherwise just update the path
      return `import { ${importedSymbols} } from './core/auth.js';`;
    }
  },
  {
    // Match import { something } from './authService.js';
    pattern: /import\s+\{\s*([^}]+)\s*\}\s+from\s+['"](.\/|\.\.\/)+authService\.js['"];?/g,
    replacement: (match, importedSymbols) => {
      // If it references AUTH_STATE, update to the proper casing
      if (importedSymbols.includes('AUTH_STATE as authState')) {
        return `import { AUTH_STATE } from './core/auth.js';\n\n// For backwards compatibility\nconst authState = AUTH_STATE;`;
      }
      
      return `import { ${importedSymbols} } from './core/auth.js';`;
    }
  },
  {
    // Match import { something } from './viewManager.js';
    pattern: /import\s+\{\s*([^}]+)\s*\}\s+from\s+['"](.\/|\.\.\/)+viewManager\.js['"];?/g,
    replacement: (match, importedSymbols) => {
      return `import { ${importedSymbols} } from './core/views.js';`;
    }
  }
];

/**
 * Recursively scans a directory for files
 */
async function scanDirectory(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    // Skip files we want to ignore
    if (SKIP_FILES.some(skip => entry.name.includes(skip))) {
      continue;
    }
    
    if (entry.isDirectory()) {
      const subDirFiles = await scanDirectory(fullPath);
      files.push(...subDirFiles);
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.jsx'))) {
      files.push(fullPath);
    }
  }
  
  return files;
}

/**
 * Fix imports in a file
 */
async function fixImportsInFile(filePath) {
  try {
    const content = await readFile(filePath, 'utf-8');
    let modified = false;
    let newContent = content;
    
    for (const { pattern, replacement } of IMPORT_PATTERNS) {
      const matches = content.match(pattern);
      if (matches) {
        modified = true;
        newContent = newContent.replace(pattern, replacement);
      }
    }
    
    if (modified) {
      await writeFile(filePath, newContent, 'utf-8');
      console.log(`✅ Fixed imports in ${path.relative(CLIENT_DIR, filePath)}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`❌ Error fixing imports in ${filePath}:`, error);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('🔍 Scanning for files to fix...');
    const files = await scanDirectory(CLIENT_DIR);
    console.log(`Found ${files.length} JavaScript files to check.`);
    
    let fixedCount = 0;
    
    for (const file of files) {
      const fixed = await fixImportsInFile(file);
      if (fixed) fixedCount++;
    }
    
    console.log(`\n✨ Done! Fixed imports in ${fixedCount} files.`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the script
main().catch(console.error); 