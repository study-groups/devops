const path = require('path');

const markdownDirectory = process.env.MD_DIR || path.join(__dirname, '../md');
const imagesDirectory = path.join(markdownDirectory, '../images');
const uploadsDirectory = path.join(__dirname, '../uploads');

module.exports = {
    markdownDirectory,
    imagesDirectory,
    uploadsDirectory,
    port: process.env.PORT || 4000
};
