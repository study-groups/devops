/**
 * System Commands Generator
 * 
 * Generates individual command files for the saved-commands/system/ directory
 * Each command is a separate JSON file following the unified command structure
 */

const fs = require('fs/promises');
const path = require('path');

// Define all system commands
const SYSTEM_COMMANDS = [
    {
        id: 'sys-pwd',
        name: 'Get Current Directory',
        description: 'Show current working directory',
        command: 'pwd',
        type: 'system',
        category: 'filesystem',
        environment: 'local',
        options: {
            systemCommand: true,
            safe: true,
            readOnly: true
        },
        expectedOutput: 'string',
        tags: ['filesystem', 'directory', 'location']
    },
    {
        id: 'sys-disk-usage',
        name: 'Disk Usage Summary',
        description: 'Show disk space usage for all mounted filesystems',
        command: 'df -h',
        type: 'system',
        category: 'system-info',
        environment: 'local',
        options: {
            systemCommand: true,
            safe: true,
            readOnly: true
        },
        expectedOutput: 'table',
        tags: ['disk', 'storage', 'filesystem', 'monitoring']
    },
    {
        id: 'sys-memory',
        name: 'Memory Usage',
        description: 'Show system memory usage and availability',
        command: 'free -h',
        type: 'system',
        category: 'system-info',
        environment: 'local',
        options: {
            systemCommand: true,
            safe: true,
            readOnly: true
        },
        expectedOutput: 'table',
        tags: ['memory', 'ram', 'system', 'monitoring']
    },
    {
        id: 'sys-processes',
        name: 'Running Processes',
        description: 'Show currently running processes',
        command: 'ps aux | head -20',
        type: 'system',
        category: 'process-info',
        environment: 'local',
        options: {
            systemCommand: true,
            safe: true,
            readOnly: true
        },
        expectedOutput: 'table',
        tags: ['processes', 'system', 'monitoring']
    },
    {
        id: 'sys-uptime',
        name: 'System Uptime',
        description: 'Show how long the system has been running',
        command: 'uptime',
        type: 'system',
        category: 'system-info',
        environment: 'local',
        options: {
            systemCommand: true,
            safe: true,
            readOnly: true
        },
        expectedOutput: 'string',
        tags: ['uptime', 'system', 'monitoring']
    },
    {
        id: 'sys-network-interfaces',
        name: 'Network Interfaces',
        description: 'Show network interface configuration',
        command: 'ip addr show || ifconfig',
        type: 'system',
        category: 'network',
        environment: 'local',
        options: {
            systemCommand: true,
            safe: true,
            readOnly: true
        },
        expectedOutput: 'multiline',
        tags: ['network', 'interfaces', 'ip', 'configuration']
    },
    {
        id: 'sys-env-vars',
        name: 'Environment Variables',
        description: 'Show current environment variables',
        command: 'env | sort',
        type: 'system',
        category: 'environment',
        environment: 'local',
        options: {
            systemCommand: true,
            safe: true,
            readOnly: true
        },
        expectedOutput: 'multiline',
        tags: ['environment', 'variables', 'configuration']
    },
    {
        id: 'sys-node-version',
        name: 'Node.js Version',
        description: 'Show Node.js version and configuration',
        command: 'node --version && npm --version',
        type: 'system',
        category: 'development',
        environment: 'local',
        options: {
            systemCommand: true,
            safe: true,
            readOnly: true
        },
        expectedOutput: 'multiline',
        tags: ['nodejs', 'npm', 'development', 'version']
    },
    {
        id: 'sys-git-status',
        name: 'Git Repository Status',
        description: 'Show current git repository status',
        command: 'git status --porcelain && echo "--- Branches ---" && git branch -v',
        type: 'system',
        category: 'development',
        environment: 'local',
        options: {
            systemCommand: true,
            safe: true,
            readOnly: true
        },
        expectedOutput: 'multiline',
        tags: ['git', 'version-control', 'development', 'status']
    },
    {
        id: 'sys-playwright-processes',
        name: 'Playwright Processes',
        description: 'Show running Playwright and test processes',
        command: 'ps aux | grep -E "(playwright|npx.*test)" | grep -v grep || echo "No Playwright processes found"',
        type: 'system',
        category: 'testing',
        environment: 'local',
        options: {
            systemCommand: true,
            safe: true,
            readOnly: true
        },
        expectedOutput: 'multiline',
        tags: ['playwright', 'testing', 'processes', 'monitoring']
    }
];

// Generate command JSON structure
function generateCommandJson(command) {
    const now = new Date().toISOString();
    
    return {
        id: command.id,
        name: command.name,
        description: command.description,
        command: command.command,
        type: command.type,
        category: command.category,
        environment: command.environment,
        options: command.options,
        expectedOutput: command.expectedOutput,
        tags: command.tags,
        metadata: {
            generated: true,
            generatedAt: now,
            version: '1.0',
            source: 'system-commands-generator.js'
        },
        createdAt: now,
        updatedAt: now
    };
}

// Generate all command files
async function generateSystemCommands(outputDir) {
    try {
        // Ensure output directory exists
        await fs.mkdir(outputDir, { recursive: true });
        
        console.log(`Generating ${SYSTEM_COMMANDS.length} system commands in ${outputDir}...`);
        
        const results = [];
        
        for (const command of SYSTEM_COMMANDS) {
            const commandJson = generateCommandJson(command);
            const filename = `${command.id}.json`;
            const filepath = path.join(outputDir, filename);
            
            await fs.writeFile(filepath, JSON.stringify(commandJson, null, 2));
            
            results.push({
                id: command.id,
                name: command.name,
                filename,
                filepath
            });
            
            console.log(`✓ Generated: ${filename}`);
        }
        
        // Generate index file
        const indexPath = path.join(outputDir, 'index.json');
        const indexData = {
            type: 'system-commands-index',
            generated: new Date().toISOString(),
            commands: results,
            categories: [...new Set(SYSTEM_COMMANDS.map(cmd => cmd.category))],
            totalCommands: results.length
        };
        
        await fs.writeFile(indexPath, JSON.stringify(indexData, null, 2));
        console.log(`✓ Generated index: index.json`);
        
        console.log(`\n🎉 Successfully generated ${results.length} system commands!`);
        return results;
        
    } catch (error) {
        console.error('Error generating system commands:', error);
        throw error;
    }
}

// If run directly, generate commands
if (require.main === module) {
    const outputDir = process.argv[2] || './system-commands';
    generateSystemCommands(outputDir)
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Failed to generate system commands:', error);
            process.exit(1);
        });
}

module.exports = {
    SYSTEM_COMMANDS,
    generateCommandJson,
    generateSystemCommands
};
