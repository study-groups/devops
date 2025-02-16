const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

// Set directories
const markdownDirectory = process.env.PWD || path.join(__dirname, 'md');
const staticDirectory = __dirname;

try {
    fs.accessSync(markdownDirectory, fs.constants.R_OK | fs.constants.W_OK);
    console.log(`Markdown directory set to: ${markdownDirectory}`);
} catch (err) {
    console.error(`Cannot access markdown directory ${markdownDirectory}`);
    process.exit(1);
}

app.use(express.static(staticDirectory));
app.use(express.json());

app.get('/pwd', (req, res) => res.json({ pwd: markdownDirectory }));

app.get('/files', (req, res) => {
    fs.readdir(markdownDirectory, (err, files) => {
        if (err) return res.status(500).json({ error: 'Unable to read directory' });
        res.json(files.filter(file => file.endsWith('.md')));
    });
});

app.get('/:filename.md', (req, res) => {
    const filePath = path.join(markdownDirectory, `${req.params.filename}.md`);
    if (!filePath.startsWith(markdownDirectory)) return res.status(403).json({ error: 'Access denied' });
    fs.access(filePath, fs.constants.R_OK, err => {
        if (err) return res.status(404).send('File not found');
        res.sendFile(filePath);
    });
});

app.post('/save/:filename', (req, res) => {
    const { filename } = req.params;
    if (!filename || !filename.endsWith('.md')) return res.status(400).send('Invalid file name');
    const filePath = path.join(markdownDirectory, filename);
    if (!filePath.startsWith(markdownDirectory)) return res.status(403).json({ error: 'Access denied' });
    fs.writeFile(filePath, req.body.content, err => {
        if (err) return res.status(500).send('Error saving file');
        res.send('File saved');
    });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}, serving markdown from ${markdownDirectory}`));
