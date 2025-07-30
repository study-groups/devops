import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs-extra';

function getErrorStatusAndMessage(error) {
    let status = 500;
    let message = 'Internal Server Error';

    if (error.message?.includes('Permission denied')) status = 403;
    else if (error.message?.includes('not found')) status = 404;
    else if (error.message?.includes('not a file') || error.message?.includes('not a directory')) status = 400;
    else if (error.message?.includes('Invalid path')) status = 400;

    if (status !== 500) message = error.message;
    
    return { status, message };
}

export function createPDataRoutes(pdataInstance) {
    const router = express.Router();

    const tempUploadDir = path.join(pdataInstance.uploadsDir, 'temp');
    fs.ensureDirSync(tempUploadDir);
    const upload = multer({ dest: tempUploadDir });

    router.use((req, res, next) => {
        if (!req.isAuthenticated()) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        req.pdata = pdataInstance;
        next();
    });

    router.get('/list', async (req, res) => {
        try {
            const { dirs, files } = await req.pdata.listDirectory(req.user.username, req.query.dir || '');
            res.json({ dirs: dirs.map(name => ({ name })), files: files.map(name => ({ name })) });
        } catch (error) {
            const { status, message } = getErrorStatusAndMessage(error);
            res.status(status).json({ error: message });
        }
    });
        
    router.get('/read', async (req, res) => {
        try {
            const { file } = req.query;
            if (!file) return res.status(400).json({ error: 'File path is required' });
            
            const content = await req.pdata.readFile(req.user.username, file);
            res.type(path.extname(file)).send(content);
        } catch (error) {
            const { status, message } = getErrorStatusAndMessage(error);
            res.status(status).json({ error: message });
        }
    });

    router.post('/write', async (req, res) => {
        try {
            const { file, content } = req.body;
            if (!file || content === undefined) return res.status(400).json({ error: 'File path and content are required' });
            
            await req.pdata.writeFile(req.user.username, file, content);
            res.json({ success: true });
        } catch (error) {
            const { status, message } = getErrorStatusAndMessage(error);
            res.status(status).json({ error: message });
        }
    });

    router.delete('/delete', async (req, res) => {
        try {
            const { file } = req.body;
            if (!file) return res.status(400).json({ error: 'File path is required' });

            await req.pdata.deleteFile(req.user.username, file);
            res.json({ success: true });
        } catch (error) {
            const { status, message } = getErrorStatusAndMessage(error);
            res.status(status).json({ error: message });
        }
    });

    router.post('/upload', upload.single('file'), async (req, res) => {
        try {
            if (!req.file) return res.status(400).json({ error: 'No file provided' });

            const relativeUrlPath = await req.pdata.handleUpload(req.file);
            res.json({ success: true, url: relativeUrlPath });
        } catch (error) {
            res.status(500).json({ error: 'Error processing uploaded file' });
        }
    });

    return router;
}
