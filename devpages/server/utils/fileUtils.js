const fs = require('fs').promises;
const path = require('path');

function readMarkdownFiles(directory) {
    return fs.readdirSync(directory).filter(f => f.endsWith('.md'));
}

function getFileStats(filePath) {
    return fs.existsSync(filePath) ? fs.statSync(filePath) : null;
}

async function updateFileTags(username, filename, tags) {
    const metaFile = path.join(getUserMarkdownDirectory(username), '.meta.json');
    let meta = {};
    
    try {
        const content = await fs.readFile(metaFile, 'utf8');
        meta = JSON.parse(content);
    } catch (error) {
        // File doesn't exist or is invalid, start fresh
    }
    
    meta[filename] = meta[filename] || {};
    meta[filename].tags = tags;
    
    await fs.writeFile(metaFile, JSON.stringify(meta, null, 2));
}

async function getFileTags(username, filename) {
    const metaFile = path.join(getUserMarkdownDirectory(username), '.meta.json');
    try {
        const content = await fs.readFile(metaFile, 'utf8');
        const meta = JSON.parse(content);
        return meta[filename]?.tags || [];
    } catch (error) {
        return [];
    }
}

async function getFileRankings(directory) {
    const metaFile = path.join(directory, '.rankings.json');
    try {
        const content = await fs.readFile(metaFile, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        // If no rankings exist, return empty object
        return {};
    }
}

async function updateFileRanking(directory, filename, rank) {
    const metaFile = path.join(directory, '.rankings.json');
    let rankings = {};
    
    try {
        const content = await fs.readFile(metaFile, 'utf8');
        rankings = JSON.parse(content);
    } catch (error) {
        // File doesn't exist or is invalid, start fresh
    }
    
    rankings[filename] = rank;
    await fs.writeFile(metaFile, JSON.stringify(rankings, null, 2));
}

module.exports = { readMarkdownFiles, getFileStats, updateFileTags, getFileTags, getFileRankings, updateFileRanking };
