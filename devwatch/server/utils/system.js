/**
 * System Utilities
 * 
 * System health and process information utilities
 */

const os = require('os');

/**
 * Get system health data
 */
function getSystemHealthData() {
    // Note: Node.js doesn't have a built-in way to get disk usage easily
    // Providing placeholder disk info to satisfy the UI expectations
    const diskInfo = {
        size: 'Unknown',
        used: 'Unknown', 
        usePercent: 'N/A'
    };

    return {
        uptime: os.uptime(),
        memory: {
            total: os.totalmem(),
            free: os.freemem(),
            used: os.totalmem() - os.freemem(),
            usagePercent: ((os.totalmem() - os.freemem()) / os.totalmem()) * 100
        },
        disk: diskInfo,
        cpu: {
            cores: os.cpus().length,
            architecture: os.arch()
        },
        loadAverage: os.loadavg(),
        platform: {
            type: os.type(),
            release: os.release(),
            hostname: os.hostname()
        }
    };
}

/**
 * Get process information
 */
function getProcessInfoData() {
    return {
        pid: process.pid,
        ppid: process.ppid,
        cwd: process.cwd(),
        execPath: process.execPath,
        version: process.version,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        versions: process.versions,
        env: {
            platform: process.platform,
            arch: process.arch,
            nodeEnv: process.env.NODE_ENV || 'development',
            count: Object.keys(process.env).length
        },
        argv: process.argv
    };
}

/**
 * Get simplified health check
 */
function getHealthCheck() {
    return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: {
            usage: process.memoryUsage(),
            system: {
                total: os.totalmem(),
                free: os.freemem(),
                usagePercent: ((os.totalmem() - os.freemem()) / os.totalmem()) * 100
            }
        },
        cpu: {
            cores: os.cpus().length,
            load: os.loadavg()
        }
    };
}

module.exports = {
    getSystemHealthData,
    getProcessInfoData,
    getHealthCheck
};