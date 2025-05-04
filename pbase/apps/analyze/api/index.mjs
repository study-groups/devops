import { startServer } from './server.mjs';

const app = await startServer().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
});

export { app }; 