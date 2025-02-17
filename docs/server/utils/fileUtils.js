const fs = require('fs');
const path = require('path');

function readMarkdownFiles(directory) {
    return fs.readdirSync(directory).filter(f => f.endsWith('.md'));
}

function getFileStats(filePath) {
    return fs.existsSync(filePath) ? fs.statSync(filePath) : null;
}

module.exports = { readMarkdownFiles, getFileStats };
