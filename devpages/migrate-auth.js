#!/usr/bin/env node

/**
 * Migration script to replace legacy auth system with new RTK Query + PData system
 * 
 * This script:
 * 1. Backs up old files
 * 2. Replaces them with new implementations
 * 3. Updates imports in the main files
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('🔄 Starting authentication system migration...\n');

// Step 1: Backup old files
console.log('📦 Creating backups...');

const backups = [
  {
    from: 'client/store/slices/authSlice.js',
    to: 'client/store/slices/authSlice.old.js'
  },
  {
    from: 'server/middleware/auth.js',
    to: 'server/middleware/auth.old.js'
  },
  {
    from: 'server/routes/auth.js',
    to: 'server/routes/auth.old.js'
  }
];

for (const backup of backups) {
  const fromPath = path.join(__dirname, backup.from);
  const toPath = path.join(__dirname, backup.to);
  
  if (fs.existsSync(fromPath)) {
    fs.copyFileSync(fromPath, toPath);
    console.log(`✅ Backed up ${backup.from} -> ${backup.to}`);
  } else {
    console.log(`⚠️  File not found: ${backup.from}`);
  }
}

// Step 2: Replace with new files
console.log('\n🔄 Replacing with new implementations...');

const replacements = [
  {
    from: 'client/store/slices/authSlice.new.js',
    to: 'client/store/slices/authSlice.js'
  },
  {
    from: 'server/middleware/auth.new.js',
    to: 'server/middleware/auth.js'
  },
  {
    from: 'server/routes/auth.new.js',
    to: 'server/routes/auth.js'
  }
];

for (const replacement of replacements) {
  const fromPath = path.join(__dirname, replacement.from);
  const toPath = path.join(__dirname, replacement.to);
  
  if (fs.existsSync(fromPath)) {
    fs.copyFileSync(fromPath, toPath);
    console.log(`✅ Replaced ${replacement.to} with new implementation`);
    
    // Remove the .new file
    fs.unlinkSync(fromPath);
    console.log(`🗑️  Removed temporary file ${replacement.from}`);
  } else {
    console.log(`❌ New file not found: ${replacement.from}`);
  }
}

// Step 3: Update imports in appState.js
console.log('\n🔧 Updating imports...');

const appStatePath = path.join(__dirname, 'client/appState.js');
if (fs.existsSync(appStatePath)) {
  let content = fs.readFileSync(appStatePath, 'utf8');
  
  // Replace the old authSlice import
  content = content.replace(
    "import { authReducer, authThunks } from '/client/store/slices/authSlice.js';",
    "import authReducer, { authThunks } from '/client/store/slices/authSlice.js';"
  );
  
  fs.writeFileSync(appStatePath, content);
  console.log('✅ Updated appState.js imports');
} else {
  console.log('❌ appState.js not found');
}

// Step 4: Update server.js imports
console.log('\n🔧 Updating server imports...');

const serverPath = path.join(__dirname, 'server/server.js');
if (fs.existsSync(serverPath)) {
  let content = fs.readFileSync(serverPath, 'utf8');
  
  // Replace the old auth middleware import
  content = content.replace(
    "import { authMiddleware } from './middleware/auth.js';",
    "import { authMiddleware } from './middleware/auth.new.js';"
  );
  
  // Replace the old auth routes import
  content = content.replace(
    "import authRoutes from './routes/auth.js';",
    "import authRoutes from './routes/auth.new.js';"
  );
  
  fs.writeFileSync(serverPath, content);
  console.log('✅ Updated server.js imports');
} else {
  console.log('❌ server.js not found');
}

console.log('\n🎉 Migration completed!');
console.log('\n📋 Next steps:');
console.log('1. Test the new authentication system');
console.log('2. Update any remaining components to use RTK Query hooks');
console.log('3. Remove legacy API code once everything is working');
console.log('\n⚠️  If there are issues, you can restore from the .old backup files');
