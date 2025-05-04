// Import the CLI handler
const cliHandler = require('../routes/cli');

// Register the CLI endpoint
router.use('/cli', cliHandler); 