const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(__dirname));

// Endpoint: Returns current working directory as JSON.
app.get('/pwd', (req, res) => {
  res.json({ pwd: process.cwd() });
});

// Endpoint: Returns list of markdown files in current directory.
app.get('/files', (req, res) => {
  fs.readdir(process.cwd(), (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Unable to read directory.' });
    }
    const mdFiles = files.filter(file => file.endsWith('.md'));
    res.json(mdFiles);
  });
});

// Existing endpoints for file retrieval and saving.
app.get('/*.md', (req, res) => {
  const filePath = path.join(__dirname, req.path);
  fs.access(filePath, fs.constants.R_OK, err => {
    if (err) return res.status(404).send('File not found.');
    res.sendFile(filePath);
  });
});

app.post('/save/*', (req, res) => {
  const fileName = req.params[0];
  if (!fileName.endsWith('.md')) {
    return res.status(400).send('Invalid file type.');
  }
  const filePath = path.join(__dirname, fileName);
  fs.writeFile(filePath, req.body.content, err => {
    if (err) return res.status(500).send('Error saving file.');
    res.send('File saved.');
  });
});

// Endpoint: Sync state (dummy implementation).
app.post('/sync', (req, res) => {
  // In a production system, persist state as needed.
  res.send('State synced.');
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
