// Statistics Utilities - Directory and process statistics

const fs = require('fs/promises');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Get directory statistics
async function getDirectoryStats(dirPath) {
    try {
        const stat = await fs.stat(dirPath);
        if (!stat.isDirectory()) {
            return { exists: false };
        }
        
        const files = await fs.readdir(dirPath);
        const fileStats = await Promise.all(
            files.map(async file => {
                try {
                    const filePath = path.join(dirPath, file);
                    const fileStat = await fs.stat(filePath);
                    return {
                        name: file,
                        size: fileStat.size,
                        modified: fileStat.mtime,
                        isFile: fileStat.isFile()
                    };
                } catch (e) {
                    return null;
                }
            })
        );
        
        const validFiles = fileStats.filter(f => f && f.isFile);
        const totalSize = validFiles.reduce((sum, f) => sum + f.size, 0);
        const lastModified = validFiles.length > 0 ? 
            Math.max(...validFiles.map(f => f.modified.getTime())) : 
            stat.mtime.getTime();
        
        // Get disk usage if possible
        let sizeFormatted = formatBytes(totalSize);
        try {
            const { stdout } = await execAsync(`du -sh "${dirPath}" 2>/dev/null`);
            const duSize = stdout.split('\t')[0];
            if (duSize) sizeFormatted = duSize.trim();
        } catch (e) {
            // Fall back to calculated size
        }
        
        return {
            exists: true,
            fileCount: validFiles.length,
            totalFiles: files.length,
            size: sizeFormatted,
            totalBytes: totalSize,
            lastModified: new Date(lastModified).toISOString(),
            files: validFiles.slice(0, 10) // Return up to 10 most recent files
                .sort((a, b) => b.modified.getTime() - a.modified.getTime())
                .map(f => ({
                    name: f.name,
                    size: formatBytes(f.size),
                    modified: f.modified.toISOString()
                }))
        };
        
    } catch (error) {
        return { 
            exists: false, 
            error: error.message 
        };
    }
}

// Get PM2 process status
async function getProcessStatus() {
    try {
        const { stdout } = await execAsync('pm2 jlist');
        const processes = JSON.parse(stdout);
        const playwrightProcesses = processes.filter(p => 
            p.name && p.name.includes('playwright')
        );
        
        return {
            total: playwrightProcesses.length,
            running: playwrightProcesses.filter(p => p.pm2_env.status === 'online').length,
            stopped: playwrightProcesses.filter(p => p.pm2_env.status === 'stopped').length,
            errored: playwrightProcesses.filter(p => p.pm2_env.status === 'errored').length,
            processes: playwrightProcesses.map(p => ({
                name: p.name,
                pid: p.pid,
                status: p.pm2_env.status,
                uptime: p.pm2_env.pm_uptime,
                restarts: p.pm2_env.restart_time,
                memory: formatBytes(p.monit.memory),
                cpu: p.monit.cpu + '%'
            }))
        };
        
    } catch (error) {
        return {
            total: 0,
            running: 0,
            stopped: 0,
            errored: 0,
            error: error.message,
            processes: []
        };
    }
}

// Get system disk usage
async function getSystemStats(pwDir) {
    try {
        const { stdout } = await execAsync(`df -h "${pwDir}" | tail -1`);
        const [filesystem, size, used, available, usePercent, mountpoint] = stdout.trim().split(/\s+/);
        
        return {
            filesystem,
            size,
            used,
            available,
            usePercent,
            mountpoint
        };
        
    } catch (error) {
        return {
            error: error.message
        };
    }
}

// Format bytes to human readable format
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Get file age in human readable format
function getFileAge(filePath) {
    try {
        const stat = fs.statSync(filePath);
        const now = new Date();
        const modified = stat.mtime;
        const diffMs = now - modified;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return `${diffDays}d ago`;
    } catch (e) {
        return 'unknown';
    }
}

module.exports = {
    getDirectoryStats,
    getProcessStatus,
    getSystemStats,
    formatBytes,
    getFileAge
};