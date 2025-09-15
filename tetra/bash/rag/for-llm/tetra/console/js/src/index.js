const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const terminalManager = require('./services/terminal');

const PORT = process.env.PORT || 4444;
const server = http.createServer(app);
const io = new Server(server);

// Initialize terminal and connect to WebSocket
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

