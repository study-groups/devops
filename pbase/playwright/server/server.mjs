import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const modulePath = '../../../pbase/apps/analyze/api/lib/analyzers/index.mjs';
const { analyzeDomStructure } = await import(modulePath);

const app = express();
const port = process.env.PLAYWRIGHT_PORT || 3033;

app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Directory for screenshots and reports
const SCREENSHOTS_DIR = path.join(__dirname, 'data', 'screenshots');
const REPORTS_DIR = path.join(__dirname, 'reports');

// Endpoint to trigger analysis
app.post('/analyze', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        const result = await analyzeDomStructure(url, {
            screenshotPath: SCREENSHOTS_DIR
        });

        res.json(result);
    } catch (error) {
        console.error('Analysis error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint to get screenshot
app.get('/screenshots/:filename', (req, res) => {
    const filePath = path.join(SCREENSHOTS_DIR, req.params.filename);
    res.sendFile(filePath);
});

// Endpoint to get report
app.get('/reports/:filename', (req, res) => {
    const filePath = path.join(REPORTS_DIR, req.params.filename);
    res.sendFile(filePath);
});

app.listen(port, () => {
    console.log(`Playwright service listening at http://localhost:${port}`);
}); 
