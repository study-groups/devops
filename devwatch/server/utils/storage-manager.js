/**
 * Storage Manager for Playwright Test System
 * 
 * Four-layer architecture:
 * 1. Commands - Individual command instances
 * 2. Executions - Process runs with state/results  
 * 3. Jobs/Pipelines - Bree scheduled workflows
 */

const fs = require('fs/promises');
const path = require('path');
const { info, warn, error } = require('./logging');

class StorageManager {
    constructor(pwDir) {
        if (!pwDir) throw new Error('StorageManager requires a pwDir to be provided.');
        this.pwDir = pwDir;
        this.dataDir = path.join(pwDir, 'data');
        this.dirs = {
            commands: path.join(this.dataDir, 'saved-commands'), // Consolidated to one location
            executions: path.join(this.dataDir, 'executions'),
            jobs: path.join(this.dataDir, 'jobs'),
            pipelines: path.join(this.dataDir, 'pipelines')
        };
    }

    async initialize() {
        try {
            // Create all required directories
            for (const [name, dir] of Object.entries(this.dirs)) {
                try {
                    await fs.mkdir(dir, { recursive: true });
                    info(`Initialized or verified storage directory: ${name}`);
                } catch (mkdirErr) {
                    warn(`Could not create storage directory ${name}: ${mkdirErr.message}`);
                }
            }
            
            // Create index files for fast lookups
            await this.createIndexFiles();
            
            info('Storage manager initialized successfully');
        } catch (err) {
            error('Failed to initialize storage manager:', err);
            throw err;
        }
    }

    async createIndexFiles() {
        const indexes = {
            'commands-index.json': [],
            'executions-index.json': [],
            'jobs-index.json': [],
            'pipelines-index.json': []
        };

        for (const [filename, defaultContent] of Object.entries(indexes)) {
            const indexPath = path.join(this.dataDir, filename);
            try {
                await fs.access(indexPath);
            } catch {
                await fs.writeFile(indexPath, JSON.stringify(defaultContent, null, 2));
            }
        }
    }

    // Helper method to read/write JSON files safely
    async readJson(filePath, defaultValue = null) {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            return JSON.parse(content);
        } catch (err) {
            if (err.code === 'ENOENT' && defaultValue !== null) {
                return defaultValue;
            }
            throw err;
        }
    }

    async writeJson(filePath, data) {
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    }

    async updateIndex(type, item, operation = 'add') {
        const indexPath = path.join(this.dataDir, `${type}-index.json`);
        const index = await this.readJson(indexPath, []);
        
        if (operation === 'add') {
            const existing = index.find(i => i.id === item.id);
            if (existing) {
                Object.assign(existing, item);
            } else {
                index.push(item);
            }
        } else if (operation === 'remove') {
            const idx = index.findIndex(i => i.id === item.id);
            if (idx !== -1) index.splice(idx, 1);
        }
        
        await this.writeJson(indexPath, index);
    }
}

class CommandManager extends StorageManager {
    constructor(pwDir, type = 'playwright') {
        super(pwDir);
        this.type = type;
        this.commandsDir = path.join(this.dirs.commands, this.type);
    }

    generateCleanId(name) {
        // Convert name to lowercase, replace spaces/special chars with hyphens
        return name
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '-')  // Replace non-alphanumeric with hyphens
            .replace(/-+/g, '-')         // Collapse multiple hyphens
            .replace(/^-|-$/g, '');      // Remove leading/trailing hyphens
    }

    async createCommand(overrides = {}) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
        const command = {
            id: `cmd-${timestamp}`,
            name: overrides.name,
            environment: overrides.environment || 'dev',
            targetUrl: this.getTargetUrl(overrides.environment || 'dev'),
            project: overrides.project,
            options: { ...overrides.options },
            environmentVars: { ...overrides.environmentVars },
            command: overrides.command,
            createdAt: new Date().toISOString()
        };

        const filePath = path.join(this.commandsDir, `${command.id}.json`);
        await this.writeJson(filePath, command);
        
        await this.updateIndex('commands', {
            id: command.id,
            name: command.name,
            environment: command.environment,
            createdAt: command.createdAt
        });

        info(`Command created: ${command.id}`);
        return command;
    }

    // buildCommand removed - named-commands store complete command strings

    getTargetUrl(environment) {
        const urls = {
            'dev': 'https://dev.pixeljamarcade.com',
            'staging': 'https://staging.pixeljamarcade.com',
            'prod': 'https://pixeljamarcade.com',
            'local': 'http://localhost:3000'
        };
        return urls[environment] || urls['dev'];
    }

    async getCommand(id) {
        const filePath = path.join(this.commandsDir, `${id}.json`);
        return await this.readJson(filePath);
    }

    async listCommands() {
        try {
            const files = await fs.readdir(this.commandsDir);
            const commandFiles = files.filter(f => f.endsWith('.json') && f !== 'index.json');
            
            const commands = [];
            for (const file of commandFiles) {
                try {
                    const command = await this.readJson(path.join(this.commandsDir, file));
                    commands.push(command);
                } catch (e) {
                    warn(`Could not read or parse command file: ${file}`, e);
                }
            }
            return commands;
        } catch (err) {
            if (err.code === 'ENOENT') {
                warn(`Commands directory not found for type '${this.type}', returning empty list. Path: ${this.commandsDir}`);
                return []; // No directory, no commands
            }
            throw err;
        }
    }
}

class ExecutionManager extends StorageManager {
    async startExecution(commandId, activityId) {
        const commandManager = new CommandManager(this.pwDir);
        let command = null;
        try {
            command = await commandManager.getCommand(commandId);
        } catch (_) {
            // ignore read errors and continue with minimal execution record
        }
        if (!command) {
            warn(`Command not found for execution start: ${commandId}. Proceeding with minimal execution record.`);
        }

        const execution = {
            activityId,
            commandId,
            status: 'running',
            startTime: new Date().toISOString(),
            endTime: null,
            duration: null,
            outcome: null,
            command: command?.command || null,
            environment: command?.environment || null,
            targetUrl: command?.targetUrl || null,
            reportPaths: null,
            results: null,
            progress: {
                totalTests: 0,
                completedTests: 0,
                currentTest: null,
                lastUpdate: new Date().toISOString()
            }
        };

        const filePath = path.join(this.dirs.executions, `exec-${activityId}.json`);
        await this.writeJson(filePath, execution);
        
        await this.updateIndex('executions', {
            activityId,
            commandId,
            status: execution.status,
            startTime: execution.startTime,
            environment: execution.environment
        });

        info(`Execution started: ${activityId}`);
        return execution;
    }

    async updateExecution(activityId, updates) {
        const filePath = path.join(this.dirs.executions, `exec-${activityId}.json`);
        const execution = await this.readJson(filePath);
        
        Object.assign(execution, updates);
        execution.progress.lastUpdate = new Date().toISOString();
        
        await this.writeJson(filePath, execution);
        
        // Update index
        await this.updateIndex('executions', {
            activityId,
            commandId: execution.commandId,
            status: execution.status,
            startTime: execution.startTime,
            endTime: execution.endTime,
            environment: execution.environment,
            outcome: execution.outcome
        });

        return execution;
    }

    async getExecution(activityId) {
        const filePath = path.join(this.dirs.executions, `exec-${activityId}.json`);
        return await this.readJson(filePath);
    }

    async listExecutions(limit = 50) {
        const executionsDir = this.dirs.executions;
        try {
            const files = await fs.readdir(executionsDir);
            const executionFiles = files
                .filter(f => f.startsWith('exec-') && f.endsWith('.json'))
                .sort((a, b) => b.localeCompare(a)); // Sort descending by name (time)

            const executions = [];
            for (let i = 0; i < Math.min(limit, executionFiles.length); i++) {
                try {
                    const exec = await this.readJson(path.join(executionsDir, executionFiles[i]));
                    executions.push(exec);
                } catch (e) {
                    warn(`Could not read or parse execution file: ${executionFiles[i]}`, e);
                }
            }
            return executions;
        } catch (err) {
            if (err.code === 'ENOENT') return [];
            throw err;
        }
    }
}

class JobManager extends StorageManager {
    async createJob(jobData) {
        const job = {
            id: jobData.id || `job-${Date.now()}`,
            name: jobData.name,
            description: jobData.description || '',
            type: jobData.type || 'pipeline', // pipeline, single, scheduled
            schedule: jobData.schedule || null, // Bree schedule format
            pipeline: jobData.pipeline || [], // Array of command IDs
            environment: jobData.environment || 'dev',
            enabled: jobData.enabled !== false,
            metadata: jobData.metadata || {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const filePath = path.join(this.dirs.jobs, `${job.id}.json`);
        await this.writeJson(filePath, job);
        
        await this.updateIndex('jobs', {
            id: job.id,
            name: job.name,
            type: job.type,
            schedule: job.schedule,
            enabled: job.enabled,
            updatedAt: job.updatedAt
        });

        info(`Job created: ${job.id}`);
        return job;
    }

    async getJob(id) {
        const filePath = path.join(this.dirs.jobs, `${id}.json`);
        return await this.readJson(filePath);
    }

    async listJobs() {
        const indexPath = path.join(this.dataDir, 'jobs-index.json');
        return await this.readJson(indexPath, []);
    }
}

module.exports = {
    StorageManager,
    CommandManager,
    ExecutionManager,
    JobManager
};
