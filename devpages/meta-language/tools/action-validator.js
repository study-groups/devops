#!/usr/bin/env node

/**
 * Action & Event Validator
 * Prevents the "missing reducer" problem by validating schema against codebase
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import { glob } from 'glob';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../..');

class ActionValidator {
    constructor() {
        this.schema = null;
        this.errors = [];
        this.warnings = [];
    }

    async validate() {
        console.log('🔍 Loading action schema...');
        await this.loadSchema();
        
        console.log('🔍 Validating actions have reducers...');
        await this.validateActionsHaveReducers();
        
        console.log('🔍 Validating events have listeners...');
        await this.validateEventsHaveListeners();
        
        console.log('🔍 Validating action types are defined...');
        await this.validateActionTypesExist();
        
        this.printResults();
        return this.errors.length === 0;
    }

    async loadSchema() {
        try {
            const schemaPath = path.join(PROJECT_ROOT, 'meta-language/core/actionSchema.yaml');
            const schemaContent = fs.readFileSync(schemaPath, 'utf8');
            this.schema = yaml.load(schemaContent);
        } catch (error) {
            this.errors.push(`Failed to load schema: ${error.message}`);
        }
    }

    async validateActionsHaveReducers() {
        if (!this.schema?.domains) return;

        for (const [domainName, domain] of Object.entries(this.schema.domains)) {
            if (!domain.actions) continue;

            // Find reducer file for this domain - try multiple patterns
            const patterns = [
                `client/store/**/*${domainName}*reducer*.js`,
                `client/store/**/*${domainName}*Reducer*.js`,
                `client/store/**/${domainName}Reducer.js`,
                `client/store/**/${domainName}*.js`
            ];
            
            let reducerFiles = [];
            for (const pattern of patterns) {
                const files = await glob(pattern, { cwd: PROJECT_ROOT });
                reducerFiles = reducerFiles.concat(files);
            }
            // Remove duplicates
            reducerFiles = [...new Set(reducerFiles)];
            
            if (reducerFiles.length === 0) {
                this.errors.push(`❌ Domain '${domainName}' has actions but no reducer file found (pattern: ${reducerPattern})`);
                continue;
            }

            // Check each action has a case in reducer
            for (const [actionName, actionConfig] of Object.entries(domain.actions)) {
                if (actionConfig.reducer_required) {
                    const hasReducerCase = await this.checkActionInReducer(actionName, reducerFiles);
                    if (!hasReducerCase) {
                        this.errors.push(`❌ Action '${actionName}' requires reducer but not found in ${reducerFiles.join(', ')}`);
                    }
                }
            }
        }
    }

    async checkActionInReducer(actionName, reducerFiles) {
        for (const file of reducerFiles) {
            const fullPath = path.join(PROJECT_ROOT, file);
            const content = fs.readFileSync(fullPath, 'utf8');
            
            // Check for switch case or action type reference
            const patterns = [
                `case ActionTypes.${actionName}`,
                `case '${actionName}'`,
                `'${actionName}':`,
                `"${actionName}":`,
                actionName // Simple string search as fallback
            ];
            
            if (patterns.some(pattern => content.includes(pattern))) {
                return true;
            }
        }
        return false;
    }

    async validateEventsHaveListeners() {
        if (!this.schema?.domains) return;

        for (const [domainName, domain] of Object.entries(this.schema.domains)) {
            if (!domain.events) continue;

            for (const [eventName, eventConfig] of Object.entries(domain.events)) {
                const hasListeners = await this.checkEventHasListeners(eventName);
                if (!hasListeners) {
                    this.warnings.push(`⚠️ Event '${eventName}' declared but no listeners found in codebase`);
                }
            }
        }
    }

    async checkEventHasListeners(eventName) {
        const jsFiles = await glob('client/**/*.js', { cwd: PROJECT_ROOT });
        
        for (const file of jsFiles) {
            const fullPath = path.join(PROJECT_ROOT, file);
            const content = fs.readFileSync(fullPath, 'utf8');
            
            // Look for event listeners
            const patterns = [
                `eventBus.on('${eventName}'`,
                `eventBus.on("${eventName}"`,
                `addEventListener('${eventName}'`,
                `addEventListener("${eventName}"`,
                `'${eventName}'`, // Generic string search
            ];
            
            if (patterns.some(pattern => content.includes(pattern))) {
                return true;
            }
        }
        return false;
    }

    async validateActionTypesExist() {
        if (!this.schema?.domains) return;

        // Load ActionTypes file
        const actionTypesPath = path.join(PROJECT_ROOT, 'client/messaging/actionTypes.js');
        let actionTypesContent = '';
        
        try {
            actionTypesContent = fs.readFileSync(actionTypesPath, 'utf8');
        } catch (error) {
            this.errors.push(`❌ Cannot read ActionTypes file: ${error.message}`);
            return;
        }

        for (const [domainName, domain] of Object.entries(this.schema.domains)) {
            if (!domain.actions) continue;

            for (const actionName of Object.keys(domain.actions)) {
                const hasTypeDefinition = 
                    actionTypesContent.includes(`${actionName}:`) ||
                    actionTypesContent.includes(`'${actionName}'`) ||
                    actionTypesContent.includes(`"${actionName}"`);
                
                if (!hasTypeDefinition) {
                    this.errors.push(`❌ Action '${actionName}' not defined in ActionTypes`);
                }
            }
        }
    }

    printResults() {
        console.log('\n📊 Validation Results:');
        console.log('====================');
        
        if (this.errors.length === 0 && this.warnings.length === 0) {
            console.log('✅ All validations passed!');
            return;
        }

        if (this.errors.length > 0) {
            console.log('\n❌ ERRORS:');
            this.errors.forEach(error => console.log(`  ${error}`));
        }

        if (this.warnings.length > 0) {
            console.log('\n⚠️ WARNINGS:');
            this.warnings.forEach(warning => console.log(`  ${warning}`));
        }

        console.log(`\nSummary: ${this.errors.length} errors, ${this.warnings.length} warnings`);
        
        if (this.errors.length > 0) {
            console.log('\n💡 Quick fixes:');
            console.log('  - Add missing reducer cases for required actions');
            console.log('  - Define missing action types in ActionTypes.js');
            console.log('  - Create reducer files for domains with actions');
        }
    }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
    const validator = new ActionValidator();
    const success = await validator.validate();
    process.exit(success ? 0 : 1);
}

export { ActionValidator }; 