const express = require('express');
const path = require('path');
const { port } = require('./config');

const app = express();

// Serve frontend files
app.use('/client', express.static(path.join(__dirname, '../client')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Serve favicon
app.use('/favicon.ico', express.static(path.join(__dirname, '../client/favicon.ico')));

// Serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Register API routes
const markdownRoutes = require('./routes/markdown');
const imageRoutes = require('./routes/images');

app.use('/api', markdownRoutes);
app.use('/api', imageRoutes);

// Handle 404 errors for API requests
app.use('/api/*', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
