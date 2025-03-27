const fs = require('fs');
const path = require('path');

function extractImagesFromMarkdown(content) {
    const imageRegex = /!\[.*?\]\((.*?)\)/g;
    let matches, images = new Set();
    while ((matches = imageRegex.exec(content)) !== null) {
        images.add(matches[1].replace(/^\/?images\//, ''));
    }
    return [...images];
}

function getAllImages(directory) {
    return fs.readdirSync(directory).filter(img => /\.(png|jpg|jpeg|gif)$/i.test(img));
}

module.exports = { extractImagesFromMarkdown, getAllImages };

