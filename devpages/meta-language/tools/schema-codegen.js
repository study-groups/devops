#!/usr/bin/env node

/**
 * Schema Code Generator
 * Generates TypeScript types and runtime validators from action schema
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../..');

class SchemaCodeGenerator {
    constructor() {
        this.schema = null;
    }

    async generate() {
        console.log('📖 Loading schema...');
        await this.loadSchema();

        console.log('🔧 Generating TypeScript types...');
        await this.generateTypes();

        console.log('🔧 Generating runtime validators...');
        await this.generateValidators();

        console.log('🔧 Generating documentation...');
        await this.generateDocs();

        console.log('✅ Code generation complete!');
    }

    async loadSchema() {
        const schemaPath = path.join(PROJECT_ROOT, 'meta-language/core/actionSchema.yaml');
        const schemaContent = fs.readFileSync(schemaPath, 'utf8');
        this.schema = yaml.load(schemaContent);
    }

    async generateTypes() {
        const output = this.buildTypeDefinitions();
        const metaOutputPath = path.join(PROJECT_ROOT, 'meta-language/generated/generated-actions.d.ts');
        const clientOutputPath = path.join(PROJECT_ROOT, 'client/types/generated-actions.d.ts');
        
        // Ensure directories exist
        fs.mkdirSync(path.dirname(metaOutputPath), { recursive: true });
        fs.mkdirSync(path.dirname(clientOutputPath), { recursive: true });
        
        // Write to both locations
        fs.writeFileSync(metaOutputPath, output);
        fs.writeFileSync(clientOutputPath, output);
        
        console.log(`  ✅ Types written to meta-language/generated/ and client/types/`);
    }

    buildTypeDefinitions() {
        let output = `// Generated from meta-language/core/actionSchema.yaml
// DO NOT EDIT MANUALLY - Run 'npm run generate-types' to regenerate

/* eslint-disable */

`;

        // Generate state shape interfaces
        output += '// ===== STATE SHAPES =====\n\n';
        for (const [domainName, domain] of Object.entries(this.schema.domains)) {
            if (domain.state_shape) {
                output += `export interface ${this.capitalizeFirst(domainName)}State {\n`;
                for (const [key, type] of Object.entries(domain.state_shape)) {
                    output += `  ${key}: ${this.convertYamlTypeToTS(type)};\n`;
                }
                output += '}\n\n';
            }
        }

        // Generate action type unions
        output += '// ===== ACTION TYPES =====\n\n';
        for (const [domainName, domain] of Object.entries(this.schema.domains)) {
            if (domain.actions) {
                const actionNames = Object.keys(domain.actions).map(name => `'${name}'`).join(' | ');
                output += `export type ${this.capitalizeFirst(domainName)}ActionType = ${actionNames};\n`;
            }
        }

        output += '\nexport type AllActionTypes = ';
        const allDomains = Object.keys(this.schema.domains).filter(
            domain => this.schema.domains[domain].actions
        );
        output += allDomains.map(domain => `${this.capitalizeFirst(domain)}ActionType`).join(' | ');
        output += ';\n\n';

        // Generate action payload interfaces
        output += '// ===== ACTION PAYLOADS =====\n\n';
        for (const [domainName, domain] of Object.entries(this.schema.domains)) {
            if (domain.actions) {
                for (const [actionName, actionConfig] of Object.entries(domain.actions)) {
                    const payloadType = this.convertYamlTypeToTS(actionConfig.payload);
                    output += `export interface ${actionName}Payload {\n`;
                    if (payloadType !== 'void') {
                        output += `  payload: ${payloadType};\n`;
                    }
                    output += '}\n\n';
                }
            }
        }

        // Generate event payload interfaces
        output += '// ===== EVENT PAYLOADS =====\n\n';
        for (const [domainName, domain] of Object.entries(this.schema.domains)) {
            if (domain.events) {
                for (const [eventName, eventConfig] of Object.entries(domain.events)) {
                    const payloadType = this.convertYamlTypeToTS(eventConfig.payload);
                    const interfaceName = this.eventNameToInterface(eventName);
                    output += `export interface ${interfaceName}Payload {\n`;
                    if (payloadType !== 'void') {
                        output += `  payload: ${payloadType};\n`;
                    }
                    output += '}\n\n';
                }
            }
        }

        // Generate root state interface
        output += '// ===== ROOT STATE =====\n\n';
        output += 'export interface RootState {\n';
        for (const [domainName, domain] of Object.entries(this.schema.domains)) {
            if (domain.state_shape) {
                output += `  ${domainName}: ${this.capitalizeFirst(domainName)}State;\n`;
            }
        }
        output += '}\n\n';

        return output;
    }

    async generateValidators() {
        const output = this.buildValidators();
        const metaOutputPath = path.join(PROJECT_ROOT, 'meta-language/generated/action-validators.js');
        const clientOutputPath = path.join(PROJECT_ROOT, 'client/validation/action-validators.js');
        
        // Ensure directories exist
        fs.mkdirSync(path.dirname(metaOutputPath), { recursive: true });
        fs.mkdirSync(path.dirname(clientOutputPath), { recursive: true });
        
        // Write to both locations
        fs.writeFileSync(metaOutputPath, output);
        fs.writeFileSync(clientOutputPath, output);
        
        console.log(`  ✅ Validators written to meta-language/generated/ and client/validation/`);
    }

    buildValidators() {
        let output = `// Generated from meta-language/core/actionSchema.yaml
// DO NOT EDIT MANUALLY - Run 'npm run generate-validators' to regenerate

/**
 * Runtime action and event validators
 */

class ActionValidationError extends Error {
    constructor(actionType, message) {
        super(\`Invalid action '\${actionType}': \${message}\`);
        this.actionType = actionType;
    }
}

`;

        // Generate payload validators
        output += '// ===== PAYLOAD VALIDATORS =====\n\n';
        
        for (const [domainName, domain] of Object.entries(this.schema.domains)) {
            if (domain.actions) {
                for (const [actionName, actionConfig] of Object.entries(domain.actions)) {
                    output += `export function validate${actionName}Payload(payload) {\n`;
                    output += `  // Validate payload for ${actionName}\n`;
                    output += this.generatePayloadValidation(actionConfig.payload, 'payload');
                    output += '  return true;\n';
                    output += '}\n\n';
                }
            }
        }

        // Generate main validator function
        output += `// ===== MAIN VALIDATOR =====

export function validateAction(action) {
    if (!action || typeof action !== 'object') {
        throw new ActionValidationError('unknown', 'Action must be an object');
    }
    
    if (!action.type) {
        throw new ActionValidationError('unknown', 'Action must have a type property');
    }
    
    const { type, payload } = action;
    
    switch (type) {
`;

        for (const [domainName, domain] of Object.entries(this.schema.domains)) {
            if (domain.actions) {
                for (const [actionName, actionConfig] of Object.entries(domain.actions)) {
                    output += `        case '${actionName}':\n`;
                    output += `            return validate${actionName}Payload(payload);\n`;
                }
            }
        }

        output += `        default:
            console.warn(\`Unknown action type: \${type}\`);
            return true; // Don't fail for unknown actions
    }
}

export { ActionValidationError };
`;

        return output;
    }

    generatePayloadValidation(yamlType, varName) {
        if (!yamlType || yamlType === 'void') {
            return `  // No payload validation needed\n`;
        }

        if (yamlType === 'string') {
            return `  if (typeof ${varName} !== 'string') throw new ActionValidationError(type, 'Payload must be a string');\n`;
        }

        if (yamlType === 'string[]') {
            return `  if (!Array.isArray(${varName}) || !${varName}.every(item => typeof item === 'string')) {
    throw new ActionValidationError(type, 'Payload must be an array of strings');
  }\n`;
        }

        if (yamlType.includes('object')) {
            return `  if (typeof ${varName} !== 'object' || ${varName} === null) {
    throw new ActionValidationError(type, 'Payload must be an object');
  }\n`;
        }

        return `  // TODO: Add validation for type: ${yamlType}\n`;
    }

    async generateDocs() {
        const output = this.buildDocumentation();
        const metaOutputPath = path.join(PROJECT_ROOT, 'meta-language/generated/generated-action-reference.md');
        const docsOutputPath = path.join(PROJECT_ROOT, 'docs/generated-action-reference.md');
        
        // Ensure directories exist
        fs.mkdirSync(path.dirname(metaOutputPath), { recursive: true });
        fs.mkdirSync(path.dirname(docsOutputPath), { recursive: true });
        
        // Write to both locations
        fs.writeFileSync(metaOutputPath, output);
        fs.writeFileSync(docsOutputPath, output);
        
        console.log(`  ✅ Docs written to meta-language/generated/ and docs/`);
    }

    buildDocumentation() {
        let output = `# Action & Event Reference

*Generated from \`meta-language/core/actionSchema.yaml\`*

This document provides a complete reference for all actions and events in the DevPages application.

`;

        for (const [domainName, domain] of Object.entries(this.schema.domains)) {
            output += `## ${this.capitalizeFirst(domainName)} Domain\n\n`;
            output += `${domain.description}\n\n`;

            if (domain.actions) {
                output += `### Actions\n\n`;
                for (const [actionName, actionConfig] of Object.entries(domain.actions)) {
                    output += `#### \`${actionName}\`\n\n`;
                    output += `${actionConfig.description || 'No description provided'}\n\n`;
                    output += `- **Type**: ${actionConfig.type}\n`;
                    output += `- **Payload**: \`${actionConfig.payload}\`\n`;
                    output += `- **Reducer Required**: ${actionConfig.reducer_required ? 'Yes' : 'No'}\n`;
                    
                    if (actionConfig.events) {
                        output += `- **Emits Events**: ${actionConfig.events.join(', ')}\n`;
                    }
                    output += '\n';
                }
            }

            if (domain.events) {
                output += `### Events\n\n`;
                for (const [eventName, eventConfig] of Object.entries(domain.events)) {
                    output += `#### \`${eventName}\`\n\n`;
                    output += `${eventConfig.description || 'No description provided'}\n\n`;
                    output += `- **Type**: ${eventConfig.type}\n`;
                    output += `- **Payload**: \`${eventConfig.payload}\`\n`;
                    
                    if (eventConfig.listeners) {
                        output += `- **Listeners**: ${eventConfig.listeners.join(', ')}\n`;
                    }
                    output += '\n';
                }
            }
        }

        return output;
    }

    // Helper methods
    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    convertYamlTypeToTS(yamlType) {
        if (!yamlType) return 'void';
        
        const typeMap = {
            'string': 'string',
            'boolean': 'boolean',
            'number': 'number',
            'string[]': 'string[]',
            'object': 'Record<string, any>',
            'string | null': 'string | null',
            'object | null': 'Record<string, any> | null'
        };

        return typeMap[yamlType] || 'any';
    }

    eventNameToInterface(eventName) {
        return eventName
            .split(':')
            .map(part => this.capitalizeFirst(part))
            .join('') + 'Event';
    }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
    const generator = new SchemaCodeGenerator();
    await generator.generate();
}

export { SchemaCodeGenerator }; 