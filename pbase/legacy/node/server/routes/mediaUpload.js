import dotenv from 'dotenv';
import express from 'express';
import multer from 'multer';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import path from 'path';
import { authMiddleware } from '../middleware/auth.js'; // Assuming auth.js is CJS, adjust if ESM

const router = express.Router();

// Load environment variables
dotenv.config();

// --- AWS S3 Client Configuration ---
const s3Client = new S3Client({
    endpoint: `https://${process.env.SPACES_ENDPOINT}`, // Ensure protocol is included
    region: process.env.SPACES_REGION,
    credentials: {
        accessKeyId: process.env.SPACES_KEY,
        secretAccessKey: process.env.SPACES_SECRET,
    },
});

// --- Multer Configuration ---
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB limit for audio/video (adjust as needed)
const ALLOWED_MIMETYPES = ['audio/', 'video/']; // Prefixes for allowed types

const storage = multer.memoryStorage(); // Store file in memory for S3 upload

const fileFilter = (req, file, cb) => {
    if (ALLOWED_MIMETYPES.some(prefix => file.mimetype.startsWith(prefix))) {
        cb(null, true); // Accept file
    } else {
        console.log(`[MEDIA UPLOAD] Rejected file type: ${file.mimetype}`);
        cb(new Error('Invalid file type. Only audio and video files are allowed.'), false); // Reject file
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: fileFilter
}).single('mediaFile'); // Expect a single file named 'mediaFile'

// --- Route Handler ---
router.post('/upload', authMiddleware, (req, res) => {
    console.log('[MEDIA UPLOAD] Received POST request to /api/media/upload');

    upload(req, res, async function (err) {
        // Handle Multer errors first
        if (err instanceof multer.MulterError) {
            console.error('[MEDIA UPLOAD] Multer error:', err);
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({ error: `File too large. Max size is ${MAX_FILE_SIZE / 1024 / 1024}MB.` });
            }
            return res.status(400).json({ error: `Multer error: ${err.message}` });
        } else if (err) {
            // Handle other errors (e.g., file filter rejection)
            console.error('[MEDIA UPLOAD] Non-Multer error:', err);
            return res.status(400).json({ error: err.message || 'File upload failed.' });
        }

        // Check if file was received by multer
        if (!req.file) {
            console.log('[MEDIA UPLOAD] No file received in request.');
            return res.status(400).json({ error: 'No file uploaded or file type rejected.' });
        }

        console.log(`[MEDIA UPLOAD] File received: ${req.file.originalname}, Size: ${req.file.size}, Type: ${req.file.mimetype}`);

        // Proceed with S3 Upload
        const originalName = req.file.originalname;
        const sanitizedFilename = originalName.replace(/[^a-zA-Z0-9._-]/g, '_'); // Sanitize filename
        const timestamp = Date.now();
        const objectKey = `uploads/media/${timestamp}-${sanitizedFilename}`; // Define structure in Spaces

        const putObjectParams = {
            Bucket: process.env.SPACES_BUCKET,
            Key: objectKey,
            Body: req.file.buffer,
            ContentType: req.file.mimetype,
            ACL: 'public-read', // Make file publicly readable, adjust if needed
        };

        try {
            console.log(`[MEDIA UPLOAD] Uploading to Spaces: Bucket=${putObjectParams.Bucket}, Key=${objectKey}`);
            const command = new PutObjectCommand(putObjectParams);
            await s3Client.send(command);

            // Construct the URL (adjust based on your Spaces CDN/custom domain setup)
            const fileUrl = `https://${process.env.SPACES_BUCKET}.${process.env.SPACES_ENDPOINT}/${objectKey}`;
            // Or potentially just return the key/relative path if the client constructs the full URL
            const relativePath = `./${objectKey}`; // Consistent relative path format


            console.log(`[MEDIA UPLOAD] File uploaded successfully to Spaces: ${fileUrl}`);

            res.status(200).json({
                message: 'File uploaded successfully to Spaces',
                filePath: relativePath, // Send back relative path for markdown
                url: fileUrl,         // Send back the full public URL
                filename: originalName // Keep original name for reference
            });

        } catch (s3Error) {
            console.error('[MEDIA UPLOAD] S3 Upload Error:', s3Error);
            res.status(500).json({ error: 'Failed to upload file to cloud storage.', details: s3Error.message });
        }
    });
});

export default router; 