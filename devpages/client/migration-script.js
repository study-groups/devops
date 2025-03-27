/**
 * Migration Script for DevPages Refactoring
 * 
 * This script helps migrate the codebase to the new structure by:
 * 1. Finding and replacing legacy imports
 * 2. Moving and combining functionality
 * 3. Documenting what has been migrated
 */

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

// Configuration
const CLIENT_DIR = path.resolve(__dirname);
const MIGRATION_LOG = path.join(CLIENT_DIR, 'migration-log.md');
const DRY_RUN = process.argv.includes('--dry-run');

// Files to skip
const SKIP_FILES = [
  'migration-script.js',
  'migration-log.md',
  'node_modules',
  '.git',
  '.disabled',
  '.disable'
];

// Import patterns to fix
const IMPORT_PATTERNS = [
  // Auth system - improved pattern to handle more cases
  {
    pattern: /import\s+\{\s*([^}]+)\s*\}\s+from\s+['"](.\/|\.\.\/)*auth(Service|Manager)?\.js['"];?/g,
    replacement: 'import { $1 } from \'./core/index.js\';'
  },
  // View system - improved pattern
  {
    pattern: /import\s+\{\s*([^}]+)\s*\}\s+from\s+['"](.\/|\.\.\/)*view(Manager|Fix)?\.js['"];?/g,
    replacement: 'import { $1 } from \'./core/index.js\';'
  },
  // Button system
  {
    pattern: /import\s+\{\s*([^}]+)\s*\}\s+from\s+['"](.\/|\.\.\/)*buttons\.js['"];?/g,
    replacement: 'import { $1 } from \'./core/index.js\';'
  },
  // Editor system - include additional files
  {
    pattern: /import\s+\{\s*([^}]+)\s*\}\s+from\s+['"](.\/|\.\.\/)*editor(Hotfix|Fix)?\.js['"];?/g,
    replacement: 'import { $1 } from \'./core/index.js\';'
  },
  // Preview system - include all preview-related files
  {
    pattern: /import\s+\{\s*([^}]+)\s*\}\s+from\s+['"](.\/|\.\.\/)*preview(Fix|Manager)?\.js['"];?/g,
    replacement: 'import { $1 } from \'./core/index.js\';'
  },
  // Mermaid fix
  {
    pattern: /import\s+\{\s*([^}]+)\s*\}\s+from\s+['"](.\/|\.\.\/)*mermaidFix\.js['"];?/g,
    replacement: 'import { $1 } from \'./core/index.js\';'
  },
  // Image upload fix
  {
    pattern: /import\s+\{\s*([^}]+)\s*\}\s+from\s+['"](.\/|\.\.\/)*imageUploadFix\.js['"];?/g,
    replacement: 'import { $1 } from \'./core/index.js\';'
  },
  // Fix incorrect named imports of objects that should use default imports
  {
    pattern: /import\s+\{\s*(editor|auth|views|fileManager|preview)\s*\}\s+from\s+['"](.\/|\.\.\/|\/client\/)*([^'"]*)['"];?/g,
    replacement: 'import $1 from \'$2$3\';'
  },
  // Fix circular core self-imports
  {
    pattern: /from\s+['"]\.\/(core)\/([^'"]+)['"]/g,
    replacement: 'from \'./$2\''
  }
];

// Migration results
const migrationResults = {
  filesScanned: 0,
  filesModified: 0,
  importsFixed: 0,
  errors: []
};

/**
 * Recursively scan a directory for files
 */
async function scanDirectory(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    
    const files = [];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      // Skip files in the skip list
      if (SKIP_FILES.some(pattern => entry.name.includes(pattern))) {
        continue;
      }
      
      if (entry.isDirectory()) {
        const subDirFiles = await scanDirectory(fullPath);
        files.push(...subDirFiles);
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        files.push(fullPath);
      }
    }
    
    return files;
  } catch (error) {
    console.error(`Error scanning directory ${dir}:`, error);
    migrationResults.errors.push(`Failed to scan directory ${dir}: ${error.message}`);
    return [];
  }
}

/**
 * Process a file to fix imports
 */
async function processFile(filePath) {
  try {
    migrationResults.filesScanned++;
    
    // Read file content
    const content = await readFile(filePath, 'utf8');
    let newContent = content;
    let modified = false;
    
    // Apply patterns
    for (const { pattern, replacement } of IMPORT_PATTERNS) {
      // Reset regex lastIndex
      pattern.lastIndex = 0;
      
      // Count matches before replacement
      const matches = content.match(pattern);
      const matchCount = matches ? matches.length : 0;
      
      if (matchCount > 0) {
        newContent = newContent.replace(pattern, replacement);
        migrationResults.importsFixed += matchCount;
        modified = true;
      }
    }
    
    // Write updated content if modified
    if (modified) {
      migrationResults.filesModified++;
      
      const relativePath = path.relative(CLIENT_DIR, filePath);
      console.log(`Modified imports in: ${relativePath}`);
      
      if (!DRY_RUN) {
        await writeFile(filePath, newContent, 'utf8');
      }
    }
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error);
    migrationResults.errors.push(`Failed to process file ${filePath}: ${error.message}`);
  }
}

/**
 * Generate a migration log
 */
async function generateMigrationLog() {
  const timestamp = new Date().toISOString();
  const logContent = `# Migration Log - ${timestamp}

## Summary
- Files scanned: ${migrationResults.filesScanned}
- Files modified: ${migrationResults.filesModified}
- Imports fixed: ${migrationResults.importsFixed}
- Errors: ${migrationResults.errors.length}

## Patterns Applied
${IMPORT_PATTERNS.map((p, i) => `${i+1}. \`${p.pattern}\` -> \`${p.replacement}\``).join('\n')}

${migrationResults.errors.length > 0 ? '## Errors\n' + migrationResults.errors.join('\n') : ''}
`;

  if (!DRY_RUN) {
    await writeFile(MIGRATION_LOG, logContent, 'utf8');
    console.log(`Migration log written to: ${MIGRATION_LOG}`);
  } else {
    console.log('\nMigration Log (not written in dry run mode):\n');
    console.log(logContent);
  }
}

/**
 * Main function
 */
async function main() {
  console.log('Starting migration script...');
  if (DRY_RUN) {
    console.log('DRY RUN mode - no files will be modified');
  }
  
  try {
    // Scan all JS files
    console.log('Scanning files...');
    const files = await scanDirectory(CLIENT_DIR);
    
    // Process each file
    console.log(`Found ${files.length} files to process`);
    for (const file of files) {
      await processFile(file);
    }
    
    // Generate log
    await generateMigrationLog();
    
    console.log('\nSummary:');
    console.log(`- Files scanned: ${migrationResults.filesScanned}`);
    console.log(`- Files modified: ${migrationResults.filesModified}`);
    console.log(`- Imports fixed: ${migrationResults.importsFixed}`);
    console.log(`- Errors: ${migrationResults.errors.length}`);
    
    if (DRY_RUN) {
      console.log('\nThis was a dry run. Run without --dry-run to apply changes.');
    } else {
      console.log('Migration completed successfully.');
    }
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

// Run the script
main().catch(console.error); 