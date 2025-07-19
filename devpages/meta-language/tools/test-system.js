#!/usr/bin/env node

/**
 * Test script for the meta language system
 * Demonstrates validation, code generation, and error detection
 */

import { ActionValidator } from './action-validator.js';
import { SchemaCodeGenerator } from './schema-codegen.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../..');

class SystemTester {
    constructor() {
        this.testResults = {
            validation: null,
            codeGeneration: null,
            errorDetection: null
        };
    }

    async runAllTests() {
        console.log('🧪 Testing Meta Language System');
        console.log('================================\n');

        await this.testValidation();
        await this.testCodeGeneration();
        await this.testErrorDetection();

        this.printSummary();
    }

    async testValidation() {
        console.log('📋 Test 1: Action Validation');
        console.log('----------------------------');

        try {
            const validator = new ActionValidator();
            const success = await validator.validate();
            
            this.testResults.validation = {
                success,
                details: `Validation ${success ? 'passed' : 'failed'}`
            };
            
            console.log(`Result: ${success ? '✅ PASS' : '❌ FAIL'}\n`);
        } catch (error) {
            this.testResults.validation = {
                success: false,
                details: `Error: ${error.message}`
            };
            console.log(`Result: ❌ ERROR - ${error.message}\n`);
        }
    }

    async testCodeGeneration() {
        console.log('🔧 Test 2: Code Generation');
        console.log('---------------------------');

        try {
            const generator = new SchemaCodeGenerator();
            await generator.generate();
            
            // Check if files were created
            const typesPath = path.join(PROJECT_ROOT, 'meta-language/generated/generated-actions.d.ts');
            const validatorsPath = path.join(PROJECT_ROOT, 'meta-language/generated/action-validators.js');
            const docsPath = path.join(PROJECT_ROOT, 'meta-language/generated/generated-action-reference.md');
            
            const filesCreated = [
                fs.existsSync(typesPath) ? 'types' : null,
                fs.existsSync(validatorsPath) ? 'validators' : null,
                fs.existsSync(docsPath) ? 'docs' : null
            ].filter(Boolean);
            
            const success = filesCreated.length === 3;
            
            this.testResults.codeGeneration = {
                success,
                details: `Generated: ${filesCreated.join(', ')}`
            };
            
            console.log(`Result: ${success ? '✅ PASS' : '❌ FAIL'} - ${filesCreated.join(', ')}\n`);
        } catch (error) {
            this.testResults.codeGeneration = {
                success: false,
                details: `Error: ${error.message}`
            };
            console.log(`Result: ❌ ERROR - ${error.message}\n`);
        }
    }

    async testErrorDetection() {
        console.log('🔍 Test 3: Error Detection');
        console.log('---------------------------');

        try {
            // Create a temporary file with a problematic dispatch call
            const testFilePath = path.join(PROJECT_ROOT, 'temp-test-file.js');
            const problematicCode = `
// This should trigger an error
import { dispatch } from './messaging/messageQueue.js';

function badFunction() {
    // Dispatch an action that doesn't exist in schema
    dispatch({ type: 'NONEXISTENT_ACTION', payload: 'test' });
    
    // Dispatch a known action without reducer
    dispatch({ type: 'SOME_ACTION_WITHOUT_REDUCER' });
}
            `;
            
            fs.writeFileSync(testFilePath, problematicCode);
            
            // Run validation again to see if it catches the issues
            const validator = new ActionValidator();
            const success = await validator.validate();
            
            // Clean up
            fs.unlinkSync(testFilePath);
            
            this.testResults.errorDetection = {
                success: !success, // We WANT validation to fail (catching errors)
                details: `Error detection ${!success ? 'working' : 'not working'}`
            };
            
            console.log(`Result: ${!success ? '✅ PASS' : '❌ FAIL'} - Validation correctly ${!success ? 'caught errors' : 'missed errors'}\n`);
        } catch (error) {
            this.testResults.errorDetection = {
                success: false,
                details: `Error: ${error.message}`
            };
            console.log(`Result: ❌ ERROR - ${error.message}\n`);
        }
    }

    printSummary() {
        console.log('📊 Test Summary');
        console.log('===============');
        
        const results = this.testResults;
        const passed = Object.values(results).filter(r => r?.success).length;
        const total = Object.keys(results).length;
        
        console.log(`Overall: ${passed}/${total} tests passed\n`);
        
        console.log('Details:');
        console.log(`- Validation: ${results.validation?.success ? '✅' : '❌'} ${results.validation?.details}`);
        console.log(`- Code Generation: ${results.codeGeneration?.success ? '✅' : '❌'} ${results.codeGeneration?.details}`);
        console.log(`- Error Detection: ${results.errorDetection?.success ? '✅' : '❌'} ${results.errorDetection?.details}`);
        
        console.log('\n🎯 Next Steps:');
        if (passed === total) {
            console.log('✅ System is working! You can now:');
            console.log('  - Run "npm run validate-actions" before commits');
            console.log('  - Use generated types for better IntelliSense');
            console.log('  - Add the ESLint rule to catch dispatch errors');
        } else {
            console.log('❌ Some tests failed. Check the errors above and:');
            console.log('  - Ensure schema file exists and is valid YAML');
            console.log('  - Check file permissions for code generation');
            console.log('  - Verify reducer files exist for defined actions');
        }
    }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
    const tester = new SystemTester();
    await tester.runAllTests();
}

export { SystemTester }; 