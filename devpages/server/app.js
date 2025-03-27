// Import the CLI router
const cliRouter = require('./routes/cli');

// Mount the CLI router at /api/cli
app.use('/api/cli', cliRouter); 