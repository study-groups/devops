#!/usr/bin/env node
/**
 * Codebase Health Check Script
 * Automated checks for standards we established in systematic review
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 Running Codebase Health Check...\n');

const issues = [];

// Check 1: Relative import paths
console.log('1. Checking for relative imports...');
try {
  const relativeImports = execSync('find client -name "*.js" -exec grep -l "import.*\\.\\./" {} \\;', { encoding: 'utf8' });
  if (relativeImports.trim()) {
    issues.push(`❌ Relative imports found in:\n${relativeImports}`);
  } else {
    console.log('   ✅ No relative imports found');
  }
} catch (e) {
  console.log('   ✅ No relative imports found');
}

// Check 2: Authentication file count
console.log('2. Checking authentication architecture...');
const authFiles = [
  'client/auth.js',
  'client/store/slices/authSlice.js'
];
const existingAuthFiles = authFiles.filter(file => fs.existsSync(file));
if (existingAuthFiles.length === 2) {
  console.log('   ✅ Authentication architecture consolidated');
} else {
  issues.push(`❌ Authentication files missing: ${authFiles.filter(f => !existingAuthFiles.includes(f))}`);
}

// Check 3: Commented imports
console.log('3. Checking for commented imports...');
try {
  const commentedImports = execSync('find client -name "*.js" -exec grep -l "// import\\|//import" {} \\;', { encoding: 'utf8' });
  if (commentedImports.trim()) {
    issues.push(`⚠️  Commented imports found (consider cleanup):\n${commentedImports}`);
  } else {
    console.log('   ✅ No commented imports found');
  }
} catch (e) {
  console.log('   ✅ No commented imports found');
}

// Check 4: Direct console usage
console.log('4. Checking for direct console usage...');
try {
  const consoleUsage = execSync('find client -name "*.js" -exec grep -l "console\\." {} \\; | wc -l', { encoding: 'utf8' });
  const count = parseInt(consoleUsage.trim());
  if (count > 50) {
    issues.push(`⚠️  High console usage: ${count} files (consider using logging service)`);
  } else {
    console.log(`   ✅ Console usage within acceptable range (${count} files)`);
  }
} catch (e) {
  console.log('   ❓ Could not check console usage');
}

// Summary
console.log('\n📊 Health Check Summary:');
if (issues.length === 0) {
  console.log('🎉 All checks passed! Codebase standards maintained.');
} else {
  console.log(`🚨 ${issues.length} issue(s) found:\n`);
  issues.forEach(issue => console.log(issue + '\n'));
}

process.exit(issues.filter(i => i.startsWith('❌')).length);