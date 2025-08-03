const http = require('http');
const app = require('./app'); // Import the Express app
const { initializeTerminal } = require('./services/terminal');

const PORT = process.env.PORT || 3000;

// Create the HTTP server using the Express app
const server = http.createServer(app);

// Initialize the WebSocket terminal service and pass it the server
initializeTerminal(server);

server.listen(PORT, () => {
  console.log(`🚀 Tetra Console server running at http://localhost:${PORT}`);
});
