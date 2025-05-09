import { defineConfig } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config = {
    testDir: './tests',
    outputDir: path.join(__dirname, 'data'),
    reporter: [
        ['html', { outputFolder: path.join(__dirname, 'reports/html') }],
        ['json', { outputFile: path.join(__dirname, 'reports/test-results.json') }]
    ],
    use: {
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
    }
};

export default defineConfig(config); 
