import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/pjaStyleApi' });

wss.on('connection', (ws) => {
  console.error('Client connected.');

	ws.on('message', (message) => {
	  try {
		const parsed = JSON.parse(message);
		console.log(JSON.stringify(parsed)); // Always log JSON
	  } catch (e) {
		console.error(JSON.stringify({ error: 'Invalid JSON', details: e.message }));
	  }
	});

  ws.on('close', () => {
    console.log('Client disconnected.');
  });
});

server.listen(8080, () => {
  console.error('Server running on ws://localhost:8080/pjaStyleApi');
});
