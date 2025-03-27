// Import the CLI router
const cliRouter = require('./routes/cli');
const filesRouter = require('./routes/files');

// Make sure the CLI router is mounted AFTER any authentication middleware
// but BEFORE any error handling middleware
app.use('/api/cli', cliRouter);
app.use('/api/files', filesRouter);

// If there's any specific middleware needed for the CLI endpoint, add it here
// For example, if there's a specific auth middleware:
// app.use('/api/cli', authMiddleware, cliRouter); 