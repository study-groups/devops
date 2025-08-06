#!/usr/bin/env node

// Test mount resolution
import { PData } from './PData.js';

process.env.PD_DIR = '/root/pj/pd';

async function testMounts() {
    console.log('🗂️  Testing Mount Resolution...');
    
    const pdata = new PData({
        dataRoot: process.env.PD_DIR
    });
    
    // Test token creation and mount resolution
    const users = [
        { username: 'mike', role: 'admin' },
        { username: 'rich', role: 'user' }
    ];
    
    for (const { username, role } of users) {
        console.log(`\n--- Testing ${username} (${role}) ---`);
        
        try {
            // Create mock token to see mount structure
            const mockToken = {
                user: username,
                roles: [role],
                caps: [],
                mounts: await pdata._createUnifiedMounts(username, [role])
            };
            
            console.log(`Mount points:`, Object.keys(mockToken.mounts));
            console.log(`Mount mappings:`);
            for (const [virtual, physical] of Object.entries(mockToken.mounts)) {
                console.log(`  ${virtual} → ${physical}`);
                
                // Test if path exists
                const exists = await require('fs-extra').pathExists(physical);
                console.log(`    Exists: ${exists ? '✅' : '❌'}`);
            }
            
        } catch (error) {
            console.error(`❌ Error testing ${username}:`, error.message);
        }
    }
}

testMounts().catch(console.error);