// server.mjs
import express from 'express';
import cors from 'cors';
import { exec, spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import process from 'process';
import PocketBaseClient from './lib/db/pocketBaseClient.mjs';
import { analyzeDomStructure } from './lib/analyzers/index.mjs';
import Validator from './lib/utils/validator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_KEY = process.env.API_KEY;
const PORT = process.env.PORT || 5000;

async function startServer() {
    console.log('Starting server...');

    // Log the application path and port
    console.log(`Application path: ${__dirname}`);
    console.log(`Server listening on port: ${PORT}`);

    const app = express();
    
    // Add request logging middleware
    app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
        console.log('Headers:', req.headers);
        if (req.body) console.log('Body:', req.body);
        next();
    });

    app.use(cors());
    app.use(express.json());

    const verifyApiKey = (req, res, next) => {
        const apiKey = req.headers['x-api-key'];
        if (!apiKey || apiKey !== API_KEY) {
            console.log('Invalid API key attempt:', apiKey);
            return res.status(401).json({ error: 'Unauthorized' });
        }
        next();
    };

    app.post('/analyze', verifyApiKey, async (req, res) => {
        console.log('Received analyze request:', req.body);
        const { error, value } = Validator.validateAnalyzeRequest(req.body);
        if (error) {
            console.log('Validation error:', error.details[0].message);
            return res.status(400).json({ error: error.details[0].message });
        }

        try {
            const analysisResult = await analyzeDomStructure(value.InputURL);
            console.log('Analysis Result:', JSON.stringify(analysisResult, null, 2));
            
            // Validate analysis result before storage
            if (!analysisResult.nodes || !analysisResult.treeMap) {
                throw new Error('Analysis result missing required fields: nodes and treeMap');
            }
            
            await PocketBaseClient.storeAnalysisResult(value.InputURL, analysisResult);
            res.status(200).json({ message: 'Analysis completed and data stored successfully.' });
        } catch (err) {
            console.error('Analysis error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    app.get('/recent-analysis', verifyApiKey, async (req, res) => {
        try {
            // Log the request details for debugging
            console.log('Fetching recent analysis with parameters:', {
                url: 'http://localhost:8090/api/collections/html_objects/records?page=1&perPage=1&sort=-created'
            });

            const recentAnalysis = await PocketBaseClient.getMostRecentAnalysis();
            if (!recentAnalysis) {
                return res.status(404).json({ message: 'No analyses found.' });
            }
            res.status(200).json(recentAnalysis);
        } catch (err) {
            console.error('Recent-analysis error:', err);
            console.error('Error details:', {
                url: err.url,
                status: err.status,
                response: err.response,
                originalError: err.originalError
            });
            res.status(500).json({ error: 'Failed to fetch recent analysis. Please check the server logs for more details.' });
        }
    });

    app.get('/recent-analysis-summary', verifyApiKey, async (req, res) => {
        try {
            // Fetch the most recent analysis from the html_objects collection
            const recentAnalysis = await PocketBaseClient.getMostRecentAnalysis();
            
            if (!recentAnalysis) {
                return res.status(404).json({ message: 'No analyses found.' });
            }

            // Extract the necessary information
            const url = recentAnalysis.pageUrl;
            const divCount = countElements(recentAnalysis.treeMap, 'DIV');
            const iframes = extractIframes(recentAnalysis.treeMap);

            const summary = {
                url,
                divCount,
                iframes
            };

            res.status(200).json(summary);
        } catch (err) {
            console.error('Recent-analysis-summary error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // New route for extracting DOM
    app.post('/extract-dom', verifyApiKey, async (req, res) => {
        const { url, element } = req.body;

        if (!url || !element) {
            return res.status(400).json({ error: 'Missing url or element selector' });
        }

        try {
            const sanitizedUrl = url.replace(/^['"]|['"]$/g, '');
            const sanitizedElement = element.replace(/^['"]|['"]$/g, '');
            
            // Add detailed logging
            console.log('Attempting DOM extraction:', {
                originalUrl: url,
                sanitizedUrl,
                originalSelector: element,
                sanitizedSelector: sanitizedElement
            });
            
            new URL(sanitizedUrl);
            
            const extractDomPath = path.join(__dirname, 'lib', 'extractors', 'extract_dom.js');
            const nodePath = process.argv[0];
            
            const extractProcess = spawn(nodePath, [
                extractDomPath,
                sanitizedUrl,
                sanitizedElement
            ]);

            let stdout = '';
            let stderr = '';

            extractProcess.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            extractProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            extractProcess.on('close', (code) => {
                if (code !== 0) {
                    console.error(`Extract DOM process exited with code ${code}`);
                    console.error('stderr:', stderr);
                    // Add URL and selector to error response
                    return res.status(500).json({ 
                        error: 'Failed to extract DOM',
                        details: stderr,
                        attempted: {
                            url: sanitizedUrl,
                            selector: sanitizedElement
                        }
                    });
                }

                try {
                    const result = JSON.parse(stdout);
                    if (result.error) {
                        // Add URL and selector to error response
                        return res.status(400).json({
                            ...result,
                            attempted: {
                                url: sanitizedUrl,
                                selector: sanitizedElement
                            }
                        });
                    }
                    res.json(result);
                } catch (parseError) {
                    console.error('Error parsing extraction result:', parseError);
                    res.status(500).json({ 
                        error: 'Failed to parse extraction result',
                        details: stdout,
                        attempted: {
                            url: sanitizedUrl,
                            selector: sanitizedElement
                        }
                    });
                }
            });

        } catch (error) {
            console.error('Extract DOM error:', error);
            res.status(400).json({ 
                error: 'Invalid request',
                details: error.message,
                attempted: {
                    url: url,
                    element: element
                }
            });
        }
    });

    // Helper function to count elements of a specific tag
    function countElements(tree, tagName) {
        let count = 0;
        if (tree.tagName === tagName) {
            count++;
        }
        if (tree.children) {
            for (const child of tree.children) {
                count += countElements(child, tagName);
            }
        }
        return count;
    }

    // Helper function to extract iframes
    function extractIframes(tree) {
        let iframes = [];
        if (tree.tagName === 'IFRAME') {
            iframes.push({
                src: tree.attributes?.src || 'N/A',
                id: tree.id || 'N/A'
            });
        }
        if (tree.children) {
            for (const child of tree.children) {
                iframes = iframes.concat(extractIframes(child));
            }
        }
        return iframes;
    }

    // Get all collections
    app.get('/collections/all', verifyApiKey, async (req, res) => {
        try {
            const collections = await PocketBaseClient.getAllCollections('all');
            res.status(200).json({
                type: 'all',
                count: collections.length,
                collections
            });
        } catch (err) {
            console.error('Error fetching all collections:', err);
            res.status(500).json({ error: 'Failed to fetch collections.' });
        }
    });

    // Get system collections only
    app.get('/collections/system', verifyApiKey, async (req, res) => {
        try {
            const collections = await PocketBaseClient.getAllCollections('system');
            res.status(200).json({
                type: 'system',
                count: collections.length,
                collections
            });
        } catch (err) {
            console.error('Error fetching system collections:', err);
            res.status(500).json({ error: 'Failed to fetch system collections.' });
        }
    });

    // Get user collections only
    app.get('/collections/user', verifyApiKey, async (req, res) => {
        try {
            const collections = await PocketBaseClient.getAllCollections('user');
            res.status(200).json({
                type: 'user',
                count: collections.length,
                collections
            });
        } catch (err) {
            console.error('Error fetching user collections:', err);
            res.status(500).json({ error: 'Failed to fetch user collections.' });
        }
    });

    // Generic collections endpoint that accepts type parameter
    app.get('/collections/:type?', verifyApiKey, async (req, res) => {
        const validTypes = ['all', 'system', 'user'];
        const type = req.params.type || 'all';

        if (!validTypes.includes(type)) {
            return res.status(400).json({ 
                error: 'Invalid collection type',
                validTypes
            });
        }

        try {
            const collections = await PocketBaseClient.getAllCollections(type);
            res.status(200).json({
                type,
                count: collections.length,
                collections
            });
        } catch (err) {
            console.error(`Error fetching ${type} collections:`, err);
            res.status(500).json({ error: `Failed to fetch ${type} collections.` });
        }
    });

    // Update the schema endpoint to support both ID and name lookup
    app.get('/collections/:identifier/schema', verifyApiKey, async (req, res) => {
        try {
            console.log('Schema request for identifier:', req.params.identifier);
            const schema = await PocketBaseClient.getCollectionSchema(req.params.identifier);
            res.status(200).json(schema);
        } catch (err) {
            console.error('Error fetching collection schema:', err);
            
            // Get list of available collections for better error message
            try {
                const collections = await PocketBaseClient.getAllCollections();
                res.status(404).json({ 
                    error: 'Collection not found',
                    identifier: req.params.identifier,
                    availableCollections: collections.map(c => ({
                        id: c.id,
                        name: c.name
                    }))
                });
            } catch (listError) {
                res.status(404).json({ 
                    error: 'Collection not found',
                    identifier: req.params.identifier,
                    details: err.message
                });
            }
        }
    });

    // Add this new endpoint for schema summary
    app.get('/collections/:identifier/summary', verifyApiKey, async (req, res) => {
        try {
            console.log('Summary request for identifier:', req.params.identifier);
            const summary = await PocketBaseClient.getCollectionSummary(req.params.identifier);
            res.status(200).json(summary);
        } catch (err) {
            console.error('Error fetching collection summary:', err);
            
            try {
                const collections = await PocketBaseClient.getAllCollections();
                res.status(404).json({ 
                    error: 'Collection not found',
                    identifier: req.params.identifier,
                    availableCollections: collections.map(c => ({
                        id: c.id,
                        name: c.name
                    }))
                });
            } catch (listError) {
                res.status(404).json({ 
                    error: 'Collection not found',
                    identifier: req.params.identifier,
                    details: err.message
                });
            }
        }
    });

    app.use((req, res, next) => {
        console.log(`Attempted to access undefined route: ${req.method} ${req.url}`);
        res.status(404).json({
            error: `Cannot ${req.method} ${req.url}`,
            availableRoutes: [
                'POST /analyze',
                'GET /recent-analysis'
            ]
        });
    });

    try {
        await new Promise((resolve) => {
            app.listen(PORT, () => {
                console.log(`Server listening on port ${PORT}`);
                resolve();
            });
        });
    } catch (error) {
        console.error('Error starting server:', error);
    }

    return app;
}

export { startServer };

// Only call startServer if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
    startServer().catch(err => {
        console.error('Failed to start server:', err);
    });
}
