const fs = require('fs/promises');
const path = require('path');

class StatsManager {
    constructor(logFilePath, statePath, outputPath) {
        this.logFilePath = logFilePath;
        this.statePath = statePath;
        this.outputPath = outputPath;
        this.stats = {
            totalRequests: 0,
            requestsByRoute: {},
            requestsByStatus: {},
            requestsByDay: {},
            requestsByHour: {},
            lastProcessed: null
        };
    }

    async processLogs() {
        await this._loadState();

        const logContent = await fs.readFile(this.logFilePath, 'utf8');
        const lines = logContent.trim().split('\n');

        const newLines = lines.slice(this.stats.lastProcessed + 1);

        if (newLines.length === 0) {
            console.log('No new nginx logs to process.');
            return;
        }

        newLines.forEach(line => {
            try {
                const log = JSON.parse(line);
                this._updateStats(log);
            } catch (error) {
                // Ignore parsing errors
            }
        });

        this.stats.lastProcessed = lines.length - 1;
        await this._saveState();
        await this._saveStats();
    }

    async _loadState() {
        try {
            const stateContent = await fs.readFile(this.statePath, 'utf8');
            const state = JSON.parse(stateContent);
            this.stats.lastProcessed = state.lastProcessed;

            const statsContent = await fs.readFile(this.outputPath, 'utf8');
            this.stats = JSON.parse(statsContent);
            this.stats.lastProcessed = state.lastProcessed;

        } catch (error) {
            console.log('No previous state found. Starting fresh.');
        }
    }

    async _saveState() {
        await fs.mkdir(path.dirname(this.statePath), { recursive: true });
        const state = { lastProcessed: this.stats.lastProcessed };
        await fs.writeFile(this.statePath, JSON.stringify(state, null, 2));
    }

    _updateStats(log) {
        this.stats.totalRequests++;

        const [method, url] = log.request.split(' ');
        const route = `${method} ${url}`;

        this.stats.requestsByRoute[route] = (this.stats.requestsByRoute[route] || 0) + 1;
        this.stats.requestsByStatus[log.status] = (this.stats.requestsByStatus[log.status] || 0) + 1;

        const date = new Date(log.time);
        const day = date.toISOString().split('T')[0];
        const hour = date.toISOString().slice(0, 13);

        this.stats.requestsByDay[day] = (this.stats.requestsByDay[day] || 0) + 1;
        this.stats.requestsByHour[hour] = (this.stats.requestsByHour[hour] || 0) + 1;
    }

    async _saveStats() {
        await fs.mkdir(path.dirname(this.outputPath), { recursive: true });
        await fs.writeFile(this.outputPath, JSON.stringify(this.stats, null, 2));
    }
}

module.exports = StatsManager;
