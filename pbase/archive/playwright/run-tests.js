#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const playwright = spawn('npx', ['playwright', 'test'], {
    stdio: 'inherit',
    cwd: __dirname
});

playwright.on('exit', (code) => {
    if (code === 0) {
        console.log('Tests completed successfully');
    } else {
        console.error(`Tests failed with code ${code}`);
        process.exit(code);
    }
}); 