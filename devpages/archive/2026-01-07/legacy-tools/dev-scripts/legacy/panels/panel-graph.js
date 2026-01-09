#!/usr/bin/env node

/**
 * Panel Graph Analyzer
 * Analyzes panel relationships and generates visual graph representation
 */

const fs = require('fs');
const path = require('path');

const PANELS_DIR = '/root/src/devops/devpages/client/panels';

// Simple YAML parser for our specific use case
function parseYaml(content) {
    const lines = content.split('\n');
    const result = {};
    let currentPath = [];
    
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        
        const indent = line.length - line.trimLeft().length;
        const level = Math.floor(indent / 2);
        
        if (line.includes(':')) {
            const [key, value] = line.split(':').map(s => s.trim());
            
            // Adjust current path based on indentation
            currentPath = currentPath.slice(0, level);
            currentPath.push(key);
            
            // Set value in result object
            let current = result;
            for (let i = 0; i < currentPath.length - 1; i++) {
                if (!current[currentPath[i]]) current[currentPath[i]] = {};
                current = current[currentPath[i]];
            }
            
            if (value && value !== '') {
                current[key] = value.replace(/['"]/g, '');
            } else {
                current[key] = {};
            }
        } else if (line.includes('- ')) {
            // Handle arrays
            const value = line.replace(/^\s*-\s*/, '').replace(/['"]/g, '');
            let current = result;
            for (let i = 0; i < currentPath.length - 1; i++) {
                current = current[currentPath[i]];
            }
            const arrayKey = currentPath[currentPath.length - 1];
            if (!Array.isArray(current[arrayKey])) {
                current[arrayKey] = [];
            }
            current[arrayKey].push(value);
        }
    }
    
    return result;
}

// Load all panel configurations
function loadPanels() {
    const panels = new Map();
    
    function scanDirectory(dir) {
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
                scanDirectory(fullPath);
            } else if (item.endsWith('.yaml')) {
                try {
                    const content = fs.readFileSync(fullPath, 'utf8');
                    const config = parseYaml(content);
                    
                    if (config.panel && config.panel.id) {
                        panels.set(config.panel.id, {
                            ...config.panel,
                            filePath: fullPath
                        });
                    }
                } catch (error) {
                    console.error(`❌ Error parsing ${fullPath}:`, error.message);
                }
            }
        }
    }
    
    if (fs.existsSync(PANELS_DIR)) {
        scanDirectory(PANELS_DIR);
    }
    
    return panels;
}

// Analyze panel relationships
function analyzeGraph(panels) {
    const nodes = [];
    const edges = [];
    const orphans = [];
    const cycles = [];
    
    // Create nodes
    for (const [id, panel] of panels) {
        nodes.push({
            id,
            name: panel.name || id,
            tags: Array.isArray(panel.tags) ? panel.tags : [],
            hasParents: Array.isArray(panel.parents) && panel.parents.length > 0,
            hasChildren: Array.isArray(panel.children) && panel.children.length > 0
        });
    }
    
    // Create edges and find issues
    for (const [id, panel] of panels) {
        // Parent relationships
        if (Array.isArray(panel.parents)) {
            for (const parentId of panel.parents) {
                if (panels.has(parentId)) {
                    edges.push({ from: parentId, to: id, type: 'parent-child' });
                } else {
                    console.error(`❌ Missing parent panel: ${parentId} (referenced by ${id})`);
                }
            }
        }
        
        // Child relationships
        if (Array.isArray(panel.children)) {
            for (const childId of panel.children) {
                if (panels.has(childId)) {
                    edges.push({ from: id, to: childId, type: 'parent-child' });
                } else {
                    console.error(`❌ Missing child panel: ${childId} (referenced by ${id})`);
                }
            }
        }
        
        // Find orphans (no parents or children)
        if ((!Array.isArray(panel.parents) || panel.parents.length === 0) &&
            (!Array.isArray(panel.children) || panel.children.length === 0)) {
            orphans.push(id);
        }
    }
    
    return { nodes, edges, orphans, cycles };
}

// Generate visual representation
function generateVisual(analysis) {
    console.log('🎯 PANEL GRAPH ANALYSIS');
    console.log('=======================');
    
    console.log(`\n📊 Summary:`);
    console.log(`   Panels: ${analysis.nodes.length}`);
    console.log(`   Relationships: ${analysis.edges.length}`);
    console.log(`   Orphans: ${analysis.orphans.length}`);
    
    // Group by tags
    const tagGroups = {};
    for (const node of analysis.nodes) {
        for (const tag of node.tags) {
            if (!tagGroups[tag]) tagGroups[tag] = [];
            tagGroups[tag].push(node.id);
        }
    }
    
    console.log(`\n🏷️  Panels by Tag:`);
    for (const [tag, panelIds] of Object.entries(tagGroups)) {
        console.log(`   ${tag}: ${panelIds.join(', ')}`);
    }
    
    console.log(`\n🔗 Relationships:`);
    for (const edge of analysis.edges) {
        console.log(`   ${edge.from} → ${edge.to}`);
    }
    
    if (analysis.orphans.length > 0) {
        console.log(`\n🏝️  Orphaned Panels:`);
        for (const orphan of analysis.orphans) {
            console.log(`   ${orphan}`);
        }
    }
    
    // Generate Mermaid diagram
    console.log(`\n🎨 Mermaid Diagram:`);
    console.log('```mermaid');
    console.log('graph TD');
    
    // Add nodes with styling by tag
    for (const node of analysis.nodes) {
        const primaryTag = node.tags[0] || 'default';
        const className = `${primaryTag}-panel`;
        console.log(`    ${node.id}["${node.name}"]:::${className}`);
    }
    
    // Add edges
    for (const edge of analysis.edges) {
        console.log(`    ${edge.from} --> ${edge.to}`);
    }
    
    // Add styling
    console.log('    classDef settings-panel fill:#e1f5fe');
    console.log('    classDef debug-panel fill:#fff3e0');
    console.log('    classDef publish-panel fill:#e8f5e8');
    console.log('    classDef default-panel fill:#f5f5f5');
    console.log('```');
}

// Main execution
function main() {
    console.log('🔍 Loading panel configurations...');
    const panels = loadPanels();
    
    if (panels.size === 0) {
        console.log('⚠️  No panels found in', PANELS_DIR);
        return;
    }
    
    console.log(`✅ Loaded ${panels.size} panels`);
    
    const analysis = analyzeGraph(panels);
    generateVisual(analysis);
}

if (require.main === module) {
    main();
}
