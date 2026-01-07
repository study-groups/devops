const path = require('path');
const { promises: fs } = require('fs');
const FS = require('@supercharge/fs');

const PW_DIR = process.env.PW_DIR || path.join(__dirname, '..', '..');
const DOCS_DIR = path.join(PW_DIR, 'docs');

async function getDocs() {
    await FS.ensureDir(DOCS_DIR);
    const files = await fs.readdir(DOCS_DIR);
    return files
        .filter(file => file.endsWith('.md'))
        .map(file => ({ name: file }));
}

async function getDoc(filename) {
    const filePath = path.join(DOCS_DIR, filename);
    if (!await FS.exists(filePath)) {
        return null;
    }
    const content = await fs.readFile(filePath, 'utf-8');
    return { name: filename, content };
}

async function saveDoc(filename, content) {
    const filePath = path.join(DOCS_DIR, filename);
    await fs.writeFile(filePath, content, 'utf-8');
}

module.exports = {
    getDocs,
    getDoc,
    saveDoc
};
