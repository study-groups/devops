const express = require('express');
const path = require('path');

const app = express();

// Serve static files (HTML, CSS, client-side JS) from the 'public' directory
const publicDirectoryPath = path.join(__dirname, '../public');
app.use(express.static(publicDirectoryPath));

// A simple root route to ensure the app is alive
app.get('/health', (req, res) => {
  res.status(200).send({ status: 'UP' });
});

module.exports = app;
const express = require('express');
const path = require('path');

const app = express();

// Serve static files (HTML, CSS, client-side JS) from the 'public' directory
const publicDirectoryPath = path.join(__dirname, '../public');
app.use(express.static(publicDirectoryPath));

// A simple root route to ensure the app is alive
app.get('/health', (req, res) => {
  res.status(200).send({ status: 'UP' });
});

module.exports = app;

