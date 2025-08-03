import express from 'express';
import { lclNlpManager } from '../nlp/LclNlpManager.js';

const router = express.Router();

// Middleware to handle async routes
const asyncHandler = fn => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// --- Training Commands ---
router.post('/add-doc', asyncHandler(async (req, res) => {
    const { lang, utterance, intent } = req.body;
    if (!lang || !utterance || !intent) {
        return res.status(400).json({ error: 'lang, utterance, and intent are required' });
    }
    await lclNlpManager.addDocument(lang, utterance, intent);
    res.json({ success: true, message: `Added doc to intent '${intent}'` });
}));

router.post('/train', asyncHandler(async (req, res) => {
    await lclNlpManager.trainModel();
    res.json({ success: true, message: 'Training process started.' });
}));

router.post('/clear-docs', asyncHandler(async (req, res) => {
    lclNlpManager.clearDocuments();
    res.json({ success: true, message: 'All documents cleared.' });
}));

router.get('/list-intents', asyncHandler(async (req, res) => {
    const intents = lclNlpManager.listIntents();
    res.json({ success: true, intents });
}));

router.get('/list-docs', asyncHandler(async (req, res) => {
    const { intent } = req.query;
    const docs = lclNlpManager.listDocuments(intent);
    res.json({ success: true, docs });
}));

// --- Query/Inference Commands ---
router.post('/query', asyncHandler(async (req, res) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required' });
    const result = await lclNlpManager.processQuery(text);
    res.json({ success: true, result });
}));

router.post('/intent', asyncHandler(async (req, res) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required' });
    const result = await lclNlpManager.processQuery(text);
    res.json({ success: true, intent: result.intent, score: result.score });
}));

router.post('/classify', asyncHandler(async (req, res) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required' });
    const classifications = await lclNlpManager.getIntents(text);
    res.json({ success: true, classifications });
}));

router.post('/entities', asyncHandler(async (req, res) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'text is required' });
    const entities = await lclNlpManager.getEntities(text);
    res.json({ success: true, entities });
}));

// --- Model Persistence ---
router.post('/save', asyncHandler(async (req, res) => {
    const { path } = req.body;
    if (!path) return res.status(400).json({ error: 'path is required' });
    await lclNlpManager.saveModel(path);
    res.json({ success: true, message: `Model saved to ${path}` });
}));

router.post('/load', asyncHandler(async (req, res) => {
    const { path } = req.body;
    if (!path) return res.status(400).json({ error: 'path is required' });
    await lclNlpManager.loadModel(path);
    res.json({ success: true, message: `Model loaded from ${path}` });
}));

// --- Inspection / Debugging ---
router.get('/stats', asyncHandler(async (req, res) => {
    const stats = lclNlpManager.getStats();
    res.json({ success: true, stats });
}));

router.get('/info', asyncHandler(async (req, res) => {
    const info = lclNlpManager.getInfo();
    res.json({ success: true, info });
}));

router.get('/dump', asyncHandler(async (req, res) => {
    const data = lclNlpManager.dump();
    res.json({ success: true, data });
}));

export default router;
