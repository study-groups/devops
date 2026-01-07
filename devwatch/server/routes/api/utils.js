const fs = require('fs/promises');
const path = require('path');

// Helper function to get directory information
async function getDirectoryInfo(dirPath) {
    const stats = { files: 0, sizeBytes: 0, sizeFormatted: '0 B' };
    
    try {
        const dirStats = await fs.stat(dirPath);
        if (!dirStats.isDirectory()) {
            return stats;
        }
        
        const files = await fs.readdir(dirPath, { withFileTypes: true });
        let totalSize = 0;
        let fileCount = 0;
        
        for (const file of files) {
            const filePath = path.join(dirPath, file.name);
            try {
                if (file.isFile()) {
                    const fileStats = await fs.stat(filePath);
                    totalSize += fileStats.size;
                    fileCount++;
                } else if (file.isDirectory()) {
                    // Recursively check subdirectories
                    const subStats = await getDirectoryInfo(filePath);
                    totalSize += subStats.sizeBytes;
                    fileCount += subStats.files;
                }
            } catch (fileError) {
                // Skip files we can't read
                continue;
            }
        }
        
        stats.files = fileCount;
        stats.sizeBytes = totalSize;
        stats.sizeFormatted = formatBytes(totalSize);
        
    } catch (error) {
        // Directory doesn't exist or can't be read
    }
    
    return stats;
}

// Helper function to format bytes into human readable format
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Helper function to get last modified time of directory
async function getLastModified(dirPath) {
    try {
        const stats = await fs.stat(dirPath);
        return stats.mtime.toLocaleDateString();
    } catch (error) {
        return 'Unknown';
    }
}

module.exports = {
    getDirectoryInfo,
    formatBytes,
    getLastModified
};
