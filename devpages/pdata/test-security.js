#!/usr/bin/env node

// Test security isolation
import { PData } from './PData.js';

process.env.PD_DIR = '/root/pj/pd';

async function testSecurity() {
    console.log('🔒 Testing Plan 9-style Security Isolation...');
    
    const pdata = new PData({
        dataRoot: process.env.PD_DIR
    });
    
    const users = ['mike', 'rich', 'gridranger'];
    
    for (const username of users) {
        console.log(`\n--- Testing user: ${username} ---`);
        
        const roles = pdata.getUserRoles(username);
        const mounts = await pdata.mountManager.getAvailableMounts(username);
        
        console.log(`Roles: ${roles}`);
        console.log(`Mount points: ${mounts}`);
        
        // Check what capabilities they have
        const capabilities = pdata.capabilityManager.expandRolesToCapabilities(roles);
        console.log(`Capabilities: ${capabilities}`);
        
        if (username === 'rich') {
            console.log('🔍 Security check for rich:');
            console.log('- Should NOT have access to ~data (all users/projects)');
            console.log('- Should ONLY have access to ~/data/users/rich');
            
            const hasDataAccess = mounts.includes('~data');
            console.log(`- Has ~data access: ${hasDataAccess ? '❌ SECURITY VIOLATION' : '✅ SECURE'}`);
        }
    }
}

testSecurity().catch(console.error);