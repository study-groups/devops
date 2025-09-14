#!/usr/bin/env node

/**
 * validate-imports.js - Validates that all bare imports have corresponding import map entries
 * 
 * This baby step prevents the Redux-style import resolution issues by catching them early.
 */

import fs from 'fs';
import path from 'path';

// Extract import maps from HTML (there might be multiple)
function getImportMap() {
    const htmlPath = './client/index.html';
    const html = fs.readFileSync(htmlPath, 'utf8');
    
    const importMapMatches = html.matchAll(/<script type="importmap">\s*({[\s\S]*?})\s*<\/script>/g);
    let allImports = {};
    
    for (const match of importMapMatches) {
        try {
            const importMapData = JSON.parse(match[1]);
            allImports = { ...allImports, ...(importMapData.imports || {}) };
        } catch (error) {
            console.error('❌ Failed to parse import map:', error.message);
        }
    }
    
    if (Object.keys(allImports).length === 0) {
        console.error('❌ No valid import maps found in index.html');
    }
    
    return allImports;
}

// Find all bare imports in JS files
function findBareImports(dir, bareImports = new Set()) {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !['node_modules', '.git', 'dist'].includes(item)) {
            findBareImports(fullPath, bareImports);
        } else if (item.endsWith('.js') || item.endsWith('.mjs')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            
            // Match import statements with bare specifiers (no ./ or / or http)
            const importMatches = content.matchAll(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g);
            
            for (const match of importMatches) {
                const specifier = match[1];
                // Bare import if it doesn't start with ./ or / or http
                if (!specifier.startsWith('./') && !specifier.startsWith('/') && !specifier.startsWith('http')) {
                    bareImports.add(specifier);
                }
            }
        }
    }
    
    return bareImports;
}

// Main validation
function validateImports() {
    console.log('🔍 Validating import map coverage...\n');
    
    const importMap = getImportMap();
    const bareImports = findBareImports('./client');
    
    console.log(`📋 Found ${Object.keys(importMap).length} mapped imports`);
    console.log('📋 Mapped imports:', Object.keys(importMap).join(', '));
    console.log(`📋 Found ${bareImports.size} bare imports in code\n`);
    
    let hasErrors = false;
    
    // Check for unmapped bare imports
    const unmapped = [];
    for (const bareImport of bareImports) {
        if (!importMap[bareImport]) {
            unmapped.push(bareImport);
            hasErrors = true;
        }
    }
    
    if (unmapped.length > 0) {
        console.log('❌ Unmapped bare imports found:');
        unmapped.forEach(imp => console.log(`   ${imp}`));
        console.log('\n💡 Add these to your import map in index.html\n');
    }
    
    // Check for unused mappings
    const unused = [];
    for (const mapped of Object.keys(importMap)) {
        if (!bareImports.has(mapped)) {
            unused.push(mapped);
        }
    }
    
    if (unused.length > 0) {
        console.log('⚠️  Unused import map entries:');
        unused.forEach(imp => console.log(`   ${imp}`));
        console.log('\n💡 Consider removing these from your import map\n');
    }
    
    if (!hasErrors) {
        console.log('✅ All bare imports are properly mapped!');
    }
    
    return !hasErrors;
}

// Run validation
const isValid = validateImports();
process.exit(isValid ? 0 : 1);
