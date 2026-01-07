#!/usr/bin/env node

/**
 * Test script for new storage architecture
 */

const { CommandManager, ExecutionManager } = require('../server/utils/storage-manager');

async function testArchitecture() {
    const pwDir = process.env.PW_DIR || '/home/dev/pj/pw';
    console.log('🧪 Testing new storage architecture...');
    console.log(`PW_DIR: ${pwDir}`);

    try {
        // Test 1: Create a command
        console.log('\n🔨 1. Testing Commands...');
        const commandManager = new CommandManager(pwDir);
        const command = await commandManager.createCommand({
            name: 'Test Command from Script',
            command: 'npx playwright test my-test.spec.js --project=chromium',
            environment: 'dev'
        });
        console.log(`✅ Created command: ${command.id}`);
        console.log(`📝 Command: ${command.command}`);

        // Test 2: Start execution
        console.log('\n🚀 2. Testing Executions...');
        const executionManager = new ExecutionManager(pwDir);
        const activityId = `test_${Date.now()}`;
        const execution = await executionManager.startExecution(command.id, activityId);
        console.log(`✅ Started execution: ${execution.activityId}`);
        
        // Test 3: Update execution
        await executionManager.updateExecution(activityId, {
            status: 'completed',
            outcome: 'passed',
            endTime: new Date().toISOString()
        });
        console.log(`✅ Updated execution status`);
        
        // Test 4: List executions
        const executions = await executionManager.listExecutions(5);
        console.log(`✅ Found ${executions.length} executions`);
        
        console.log('\n🎉 All tests passed! New architecture is working.');
        
    } catch (err) {
        console.error('❌ Test failed:', err);
        process.exit(1);
    }
}

if (require.main === module) {
    testArchitecture().catch(console.error);
}

module.exports = { testArchitecture };
