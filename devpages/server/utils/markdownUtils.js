const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { extractImagesFromMarkdown } = require('./imageUtils');

function parseMarkdown(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = matter(content);
    return { content, metadata: parsed.data, images: extractImagesFromMarkdown(content) };
}

module.exports = { parseMarkdown };
