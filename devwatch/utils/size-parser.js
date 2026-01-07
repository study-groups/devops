/**
 * Parse human-readable size strings into bytes
 * @param {string} size - Size string like "5MB", "1GB", "512KB"
 * @returns {number|null} - Size in bytes, or null if invalid
 */
function parseSize(size) {
    if (!size || typeof size !== 'string') return null;
    
    const sizeStr = size.toString().trim().toUpperCase();
    const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*([KMGT]?B?)$/);
    
    if (!match) return null;
    
    const value = parseFloat(match[1]);
    const unit = match[2] || 'B';
    
    const multipliers = {
        'B': 1,
        'KB': 1024,
        'MB': 1024 * 1024,
        'GB': 1024 * 1024 * 1024,
        'TB': 1024 * 1024 * 1024 * 1024,
        'K': 1024,
        'M': 1024 * 1024,
        'G': 1024 * 1024 * 1024,
        'T': 1024 * 1024 * 1024 * 1024
    };
    
    return Math.floor(value * (multipliers[unit] || 1));
}

/**
 * Format bytes into human-readable string
 * @param {number} bytes - Size in bytes
 * @returns {string} - Formatted string like "5.2 MB"
 */
function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + units[i];
}

module.exports = { parseSize, formatSize };