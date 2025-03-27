/**
 * files.js - Standardized API for file operations
 */

const express = require('express');
const router = express.Router();
const fs = require('fs/promises');
const path = require('path');
const { authMiddleware } = require('../middleware/auth');

// Base directory for storing files
const getBaseDir = (req) => {
  const baseDir = process.env.MD_DIR || path.join(__dirname, '../../data');
  return baseDir;
};

// Get user directory
const getUserDir = (req) => {
  return req.user ? req.user.username : null;
};

// Helper to validate filename
const isValidFilename = (filename) => {
  return filename && 
         typeof filename === 'string' && 
         !filename.includes('..') && 
         !filename.includes('/');
};

// Helper to validate directory
const isValidDirectory = (directory) => {
  return directory && 
         typeof directory === 'string' && 
         !directory.includes('..') && 
         !directory.includes('/');
};

// Gets full path to file, with security validation
const getFullPath = (req, directory, filename) => {
  if (!isValidFilename(filename)) {
    throw new Error('Invalid filename');
  }
  
  const dir = directory || getUserDir(req);
  
  if (!isValidDirectory(dir)) {
    throw new Error('Invalid directory');
  }
  
  const baseDir = getBaseDir(req);
  return path.join(baseDir, dir, filename);
};

/**
 * GET /api/files/list
 * Get list of files in a directory
 */
router.get('/list', authMiddleware, async (req, res) => {
  try {
    const { dir } = req.query;
    const directory = dir || getUserDir(req);
    
    if (!isValidDirectory(directory)) {
      return res.status(400).json({ error: 'Invalid directory' });
    }
    
    const baseDir = getBaseDir(req);
    const fullPath = path.join(baseDir, directory);
    
    console.log(`[API] Getting files from: ${fullPath}`);
    
    const exists = await fs.access(fullPath).then(() => true).catch(() => false);
    if (!exists) {
      // Create the directory if it doesn't exist
      await fs.mkdir(fullPath, { recursive: true });
      return res.json([]);
    }
    
    const files = await fs.readdir(fullPath);
    const fileObjects = await Promise.all(files.map(async (filename) => {
      const filePath = path.join(fullPath, filename);
      const stats = await fs.stat(filePath);
      
      // Only include files, not directories
      if (stats.isFile()) {
        return {
          filename,
          name: filename,
          path: filePath,
          size: stats.size,
          modified: stats.mtime
        };
      }
      return null;
    }));
    
    // Filter out directories (null values)
    const validFiles = fileObjects.filter(f => f !== null);
    
    res.json(validFiles);
  } catch (error) {
    console.error('[API ERROR]', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/files/dirs
 * Get list of directories
 */
router.get('/dirs', authMiddleware, async (req, res) => {
  try {
    const baseDir = getBaseDir(req);
    
    // Check if base directory exists
    const exists = await fs.access(baseDir).then(() => true).catch(() => false);
    if (!exists) {
      await fs.mkdir(baseDir, { recursive: true });
      return res.json([]);
    }
    
    const entries = await fs.readdir(baseDir, { withFileTypes: true });
    const directories = entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name);
    
    // Always include the user's own directory
    const userDir = getUserDir(req);
    if (userDir && !directories.includes(userDir)) {
      // Create user directory if it doesn't exist
      const userDirPath = path.join(baseDir, userDir);
      const userDirExists = await fs.access(userDirPath).then(() => true).catch(() => false);
      
      if (!userDirExists) {
        await fs.mkdir(userDirPath, { recursive: true });
      }
      
      directories.push(userDir);
    }
    
    res.json(directories);
  } catch (error) {
    console.error('[API ERROR]', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/files/content/:dir/:file
 * Get file content
 */
router.get('/content/:dir/:file', authMiddleware, async (req, res) => {
  try {
    const directory = req.params.dir;
    const filename = req.params.file;
    
    const fullPath = getFullPath(req, directory, filename);
    
    console.log(`[API] Getting file content: ${fullPath}`);
    
    const content = await fs.readFile(fullPath, 'utf8');
    
    // Set appropriate content type
    const ext = path.extname(filename).toLowerCase();
    if (ext === '.md') {
      res.setHeader('Content-Type', 'text/markdown');
    } else {
      res.setHeader('Content-Type', 'text/plain');
    }
    
    res.send(content);
  } catch (error) {
    console.error('[API ERROR]', error);
    
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'File not found' });
    }
    
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/files/content
 * Get file content (query params version)
 */
router.get('/content', authMiddleware, async (req, res) => {
  try {
    const { dir, file } = req.query;
    
    if (!file) {
      return res.status(400).json({ error: 'Filename is required' });
    }
    
    const fullPath = getFullPath(req, dir, file);
    
    console.log(`[API] Getting file content: ${fullPath}`);
    
    const content = await fs.readFile(fullPath, 'utf8');
    
    // Set appropriate content type
    const ext = path.extname(file).toLowerCase();
    if (ext === '.md') {
      res.setHeader('Content-Type', 'text/markdown');
    } else {
      res.setHeader('Content-Type', 'text/plain');
    }
    
    res.send(content);
  } catch (error) {
    console.error('[API ERROR]', error);
    
    if (error.code === 'ENOENT') {
      return res.status(404).json({ error: 'File not found' });
    }
    
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/files/save
 * Save file content
 */
router.post('/save', authMiddleware, express.text({ type: '*/*' }), async (req, res) => {
  try {
    const { dir, file } = req.query;
    
    if (!file) {
      return res.status(400).json({ error: 'Filename is required' });
    }
    
    const content = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }
    
    const fullPath = getFullPath(req, dir, file);
    
    console.log(`[API] Saving file: ${fullPath}`);
    
    // Ensure directory exists
    const directory = path.dirname(fullPath);
    await fs.mkdir(directory, { recursive: true });
    
    // Write file content
    await fs.writeFile(fullPath, content, 'utf8');
    
    res.json({ success: true, message: 'File saved successfully' });
  } catch (error) {
    console.error('[API ERROR]', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/files/delete
 * Delete a file
 */
router.delete('/delete', authMiddleware, async (req, res) => {
  try {
    const { dir, file } = req.query;
    
    if (!file) {
      return res.status(400).json({ error: 'Filename is required' });
    }
    
    const fullPath = getFullPath(req, dir, file);
    
    console.log(`[API] Deleting file: ${fullPath}`);
    
    // Check if file exists
    const exists = await fs.access(fullPath).then(() => true).catch(() => false);
    if (!exists) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Delete file
    await fs.unlink(fullPath);
    
    res.json({ success: true, message: 'File deleted successfully' });
  } catch (error) {
    console.error('[API ERROR]', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/files/rename
 * Rename a file
 */
router.post('/rename', authMiddleware, express.json(), async (req, res) => {
  try {
    const { dir, oldName, newName } = req.body;
    
    if (!oldName || !newName) {
      return res.status(400).json({ error: 'Both old and new filenames are required' });
    }
    
    if (!isValidFilename(oldName) || !isValidFilename(newName)) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    const directory = dir || getUserDir(req);
    
    if (!isValidDirectory(directory)) {
      return res.status(400).json({ error: 'Invalid directory' });
    }
    
    const baseDir = getBaseDir(req);
    const oldPath = path.join(baseDir, directory, oldName);
    const newPath = path.join(baseDir, directory, newName);
    
    console.log(`[API] Renaming file from ${oldPath} to ${newPath}`);
    
    // Check if old file exists
    const oldExists = await fs.access(oldPath).then(() => true).catch(() => false);
    if (!oldExists) {
      return res.status(404).json({ error: 'Source file not found' });
    }
    
    // Check if new file already exists
    const newExists = await fs.access(newPath).then(() => true).catch(() => false);
    if (newExists) {
      return res.status(409).json({ error: 'Destination file already exists' });
    }
    
    // Rename file
    await fs.rename(oldPath, newPath);
    
    res.json({ success: true, message: 'File renamed successfully' });
  } catch (error) {
    console.error('[API ERROR]', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router; 