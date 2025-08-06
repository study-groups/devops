#!/usr/bin/env node

// Quick test of production PData setup
import { PData } from './PData.js';

// Set environment variable for this test
process.env.PD_DIR = '/root/pj/pd';

async function testProduction() {
    console.log('🧪 Testing PData Production Setup...');
    console.log('PD_DIR:', process.env.PD_DIR);
    
    try {
        // Initialize PData with production directory
        const pdata = new PData({
            dataRoot: process.env.PD_DIR
        });
        
        console.log('✅ PData initialized successfully');
        
        // Test token creation for existing users
        const users = ['mike', 'rich', 'gridranger'];
        
        for (const username of users) {
            console.log(`\n--- Testing user: ${username} ---`);
            
            try {
                // Get user roles
                const roles = pdata.getUserRoles(username);
                console.log(`Roles for ${username}:`, roles);
                
                // Test mount points (without requiring password)
                const mounts = await pdata.mountManager.getAvailableMounts(username);
                console.log(`Mount points for ${username}:`, mounts);
                
            } catch (error) {
                console.error(`❌ Error testing ${username}:`, error.message);
            }
        }
        
        console.log('\n🎉 Production test complete!');
        
    } catch (error) {
        console.error('❌ PData initialization failed:', error.message);
        process.exit(1);
    }
}

testProduction().catch(console.error);