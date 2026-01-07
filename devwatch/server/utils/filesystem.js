/**
 * Filesystem Utilities
 * 
 * Extracted from admin-server.js for modular architecture
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Get environment data with path resolution
 */
function getEnvironmentData() {
    const env = process.env;
    const keyVars = ['PW_DIR', 'PD_DIR', 'LOG_DIR', 'PORT', 'NODE_ENV'];
    const environmentData = {};
    
    // Add key environment variables
    keyVars.forEach(key => {
        const value = env[key];
        environmentData[key] = {
            value: value || '(not set)',
            isKey: true,
            resolved: value ? resolvePathInfo(value) : null
        };
    });
    
    // Add other relevant environment variables
    const otherVars = ['DO_SPACES_BUCKET', 'AUDIT_BUCKET', 'HOME', 'USER', 'PWD', 'SHELL'];
    otherVars.forEach(key => {
        const value = env[key];
        if (value) {
            environmentData[key] = {
                value: key.includes('SECRET') || key.includes('KEY') ? '[HIDDEN]' : value,
                isKey: false,
                resolved: (key === 'HOME' || key === 'PWD') ? resolvePathInfo(value) : null
            };
        }
    });
    
    return environmentData;
}

/**
 * Resolve path information and stats
 */
function resolvePathInfo(pathValue) {
    try {
        const resolvedPath = path.resolve(pathValue);
        const exists = fs.existsSync(resolvedPath);
        
        if (exists) {
            const stats = fs.statSync(resolvedPath);
            return {
                resolvedPath,
                exists: true,
                isDirectory: stats.isDirectory(),
                modified: stats.mtime.toISOString()
            };
        } else {
            return {
                resolvedPath,
                exists: false,
                error: 'Path does not exist'
            };
        }
    } catch (error) {
        return {
            resolvedPath: pathValue,
            exists: false,
            error: error.message
        };
    }
}

/**
 * Get comprehensive directory data
 */
function getDirectoryData(pwSrcPath, testSuites, PW_DIR) {
    const directories = {};
    
    // Primary directories to analyze
    const dirsToCheck = {
        'Playwright Source (PW_SRC)': {
            path: pwSrcPath,
            envVar: 'PW_SRC',
            description: 'Playwright test source directory'
        },
        'Playwright Working (PW_DIR)': {
            path: PW_DIR,
            envVar: 'PW_DIR', 
            description: 'Playwright execution working directory'
        },
        'Primary Data (PD_DIR)': {
            path: process.env.PD_DIR || '/home/dev/pj/pd',
            envVar: 'PD_DIR',
            description: 'Main data directory where pw_data lives'
        },
        'Logs (LOG_DIR)': {
            path: process.env.LOG_DIR || '/home/dev/.local/share/pixeljam/logs',
            envVar: 'LOG_DIR',
            description: 'Application logs directory'
        }
    };
    
    Object.entries(dirsToCheck).forEach(([name, config]) => {
        try {
            const dirInfo = { ...config };
            dirInfo.exists = fs.existsSync(config.path);
            
            if (dirInfo.exists) {
                const stats = fs.statSync(config.path);
                dirInfo.lastModified = stats.mtime.toISOString();
                
                // Get recent files
                try {
                    const files = fs.readdirSync(config.path);
                    const fileStats = files.slice(0, 10).map(file => {
                        try {
                            const filePath = path.join(config.path, file);
                            const stat = fs.statSync(filePath);
                            return {
                                name: file,
                                modified: stat.mtime.toISOString(),
                                size: stat.size
                            };
                        } catch (e) {
                            return null;
                        }
                    }).filter(Boolean);
                    
                    // Sort by modification time and take top 3
                    dirInfo.recentFiles = fileStats
                        .sort((a, b) => new Date(b.modified) - new Date(a.modified))
                        .slice(0, 3);
                    
                    dirInfo.fileCount = files.length;
                    dirInfo.totalSize = fileStats.reduce((sum, file) => sum + file.size, 0);
                } catch (e) {
                    dirInfo.error = `Could not read directory contents: ${e.message}`;
                }
            }
            
            // Add test suites for PW_SRC
            if (name.includes('Playwright Source')) {
                dirInfo.testSuites = testSuites;
            }
            
            directories[name] = dirInfo;
        } catch (error) {
            directories[name] = {
                ...config,
                exists: false,
                error: error.message
            };
        }
    });
    
    return directories;
}

/**
 * Get directory statistics
 */
async function getDirectoryStats(dirPath) {
    try {
        const stats = await fs.promises.stat(dirPath);
        if (!stats.isDirectory()) return null;

        const files = await fs.promises.readdir(dirPath);
        let totalSize = 0;
        let fileCount = 0;

        for (const file of files) {
            try {
                const filePath = path.join(dirPath, file);
                const fileStat = await fs.promises.stat(filePath);
                if (fileStat.isFile()) {
                    totalSize += fileStat.size;
                    fileCount++;
                }
            } catch (err) {
                // Skip files we can't read
            }
        }

        return {
            exists: true,
            totalSize,
            fileCount,
            lastModified: stats.mtime.toISOString()
        };
    } catch (error) {
        return {
            exists: false,
            error: error.message
        };
    }
}

module.exports = {
    getEnvironmentData,
    resolvePathInfo,
    getDirectoryData,
    getDirectoryStats
};