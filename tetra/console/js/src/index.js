const http = require('http');
const app = require('./app');
// Import the new killTerminal function
const { initializeTerminal, killTerminal } = require('./services/terminal');

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

initializeTerminal(server);

server.listen(PORT, () => {
  console.log(`🚀 Tetra Console server running at http://localhost:${PORT}`);
});

// --- Graceful Shutdown Logic ---

function gracefulShutdown(signal) {
  console.log(`\n[Server] Received ${signal}, shutting down gracefully.`);
  
  // 1. Kill the child terminal process first
  killTerminal();

  // 2. Close the HTTP server
  server.close(() => {
    console.log('[Server] HTTP server closed.');
    // 3. Exit the main process
    process.exit(0);
  });
}

// Listen for shutdown signals
// SIGINT is for Ctrl+C or `pm2 stop`
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// SIGTERM is for `pm2 delete` or standard `kill` command
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Optional: Catch unhandled errors to prevent crashes
process.on('uncaughtException', (err, origin) => {
    console.error(`[Server] Uncaught Exception at: ${origin}, error: ${err}`);
    // It's often recommended to exit after an uncaught exception
    gracefulShutdown('uncaughtException');
});
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const terminalManager = require('./services/terminal'); // Import the manager

const PORT = process.env.PORT || 4444;
const server = http.createServer(app);
const io = new Server(server);

// Start the terminal and connect it to the WebSocket server.
terminalManager.start();
terminalManager.connect(io);

server.listen(PORT, () => {
  console.log(`🚀 Tetra Console server running on port ${PORT}`);
});

// --- Clean, Async Graceful Shutdown ---

async function gracefulShutdown(signal) {
  console.log(`\n[Server] Received ${signal}, shutting down gracefully...`);
  
  // 1. Wait for the terminal manager to confirm its process is dead.
  await terminalManager.shutdown();

  // 2. Close the HTTP server.
  server.close(() => {
    console.log('[Server] HTTP server closed.');
    // 3. Exit the main process.
    process.exit(0);
  });
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

process.on('uncaughtException', (err, origin) => {
  console.error(`[Server] Uncaught Exception at: ${origin}`, err);
  gracefulShutdown('uncaughtException');
});

