import express from 'express';
import { Router } from 'express';
import path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { generateStaticHtml } from '../utils/htmlGenerator.js';

// Import config with .js extension
import { port } from '../config.js';

// Derive __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Define project root relative to this file's location
const projectRootDir = path.resolve(__dirname, '../..');

const router = Router();

// Create a slug-to-id lookup table
let slugLookupTable = {};

// Function to reload the slug lookup table
async function reloadSlugLookup() {
  try {
    const previewsDir = path.join(__dirname, '../../data/previews');
    
    // Ensure the directory exists
    try {
      await fs.mkdir(previewsDir, { recursive: true });
    } catch (mkdirError) {
      // Directory already exists, that's fine
    }
    
    // Read all preview files
    const files = await fs.readdir(previewsDir);
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    
    // Reset the lookup table
    slugLookupTable = {};
    
    // Process each file
    for (const file of jsonFiles) {
      try {
        const data = JSON.parse(await fs.readFile(path.join(previewsDir, file), 'utf8'));
        if (data.slug && data.id) {
          slugLookupTable[data.slug] = data.id;
        }
      } catch (error) {
        console.error(`[SERVER] Error processing preview file ${file}:`, error.message);
      }
    }
    
    console.log(`[SERVER] Slug lookup table reloaded with ${Object.keys(slugLookupTable).length} entries`);
  } catch (error) {
    console.error('[SERVER] Failed to reload slug lookup table:', error.message);
  }
}

// Load the lookup table on startup
reloadSlugLookup();

// Route for preview pages - handles any slug or ID format
router.get('/preview/:slug', async (req, res) => {
  const slug = req.params.slug;
  
  console.log(`[SERVER] Preview request for: ${slug}`);
  
  try {
    // Explicitly set the content type to avoid Express trying to guess
    res.setHeader('Content-Type', 'text/html');
    
    // Send the viewer HTML
    res.sendFile(path.resolve(__dirname, '../../client/preview/viewer.html'));
  } catch (error) {
    console.error(`[SERVER] Error serving preview page: ${error.message}`);
    
    // Send a more helpful error message
    res.status(500).send(`
      <html>
        <body>
          <h1>Error Loading Preview</h1>
          <p>There was an error loading the preview page: ${error.message}</p>
          <p>Please check server logs for more details.</p>
        </body>
      </html>
    `);
  }
});

// Add this alternative route for direct HTML serving
router.get('/preview-direct/:slug', (req, res) => {
  const slug = req.params.slug;
  const viewerPath = path.resolve(__dirname, '../../client/preview/viewer.html');
  
  console.log(`[SERVER] Direct preview request for: ${slug}`);
  console.log(`[SERVER] Serving file from: ${viewerPath}`);
  
  // Read the file directly instead of using sendFile
  fs.readFile(viewerPath, 'utf8').then(data => {
      // Send the file contents directly
      res.setHeader('Content-Type', 'text/html');
      res.send(data);
  }).catch(err => {
      console.error(`[SERVER] Error reading viewer.html: ${err.message}`);
      return res.status(500).send('Error loading preview page');
  });
});

// API endpoint to fetch preview data - useful for cross-device viewing
router.get('/api/preview/:idOrSlug', async (req, res) => {
  const idOrSlug = req.params.idOrSlug;
  
  // Try to determine if it's an ID or a slug
  let previewId = idOrSlug;
  
  // Check if it's in our slug lookup table
  if (slugLookupTable[idOrSlug]) {
    previewId = slugLookupTable[idOrSlug];
    console.log(`[SERVER] Found ID ${previewId} for slug ${idOrSlug}`);
  } else {
    // Extract the ID if it's a slug with our naming pattern
    const parts = idOrSlug.split('-');
    const extractedId = parts[parts.length - 1];
    
    // If we think this might be an ID at the end of a slug
    if (extractedId && extractedId.length >= 10) {
      previewId = extractedId;
      console.log(`[SERVER] Extracted ID ${previewId} from slug ${idOrSlug}`);
    }
  }
  
  try {
    // Try to load preview data from server storage
    const previewDataPath = path.join(__dirname, `../../data/previews/${previewId}.json`);
    
    try {
      const data = await fs.readFile(previewDataPath, 'utf8');
      const parsedData = JSON.parse(data);
      console.log(`[SERVER] Found and returned preview data for: ${previewId}`);
      res.json(parsedData);
    } catch (fileError) {
      // If file not found, return a 404
      console.log(`[SERVER] Preview data not found on server for ID: ${previewId}`);
      res.status(404).json({ 
        error: 'Preview not found or has expired',
        message: 'Client-side localStorage may still have this preview' 
      });
    }
  } catch (error) {
    console.error(`[SERVER] Error serving preview data: ${error.message}`);
    res.status(500).json({ error: 'Error loading preview data' });
  }
});

// API endpoint to save preview data from client to server
router.post('/api/preview', express.json(), async (req, res) => {
  try {
    const { id, content, fileName, slug } = req.body;
    
    if (!id || !content) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Create a preview data object
    const previewData = {
      id,
      content,
      fileName: fileName || 'Untitled',
      slug: slug || id,  // Store the slug for future reference
      publishedAt: new Date().toISOString()
    };
    
    // Ensure the previews directory exists
    const previewsDir = path.join(__dirname, '../../data/previews');
    try {
      await fs.mkdir(previewsDir, { recursive: true });
    } catch (mkdirError) {
      console.error(`[SERVER] Error creating previews directory: ${mkdirError.message}`);
    }
    
    // Save the preview data
    const previewPath = path.join(previewsDir, `${id}.json`);
    await fs.writeFile(previewPath, JSON.stringify(previewData, null, 2));
    
    // Update the slug lookup table
    if (previewData.slug) {
      slugLookupTable[previewData.slug] = previewData.id;
      console.log(`[SERVER] Added slug ${previewData.slug} to lookup table`);
    }
    
    console.log(`[SERVER] Saved preview data for ID: ${id}, Slug: ${slug || id}`);
    
    res.json({ 
      success: true, 
      previewUrl: `/preview/${slug || id}` 
    });
  } catch (error) {
    console.error(`[SERVER] Error saving preview data: ${error.message}`);
    res.status(500).json({ error: 'Error saving preview data' });
  }
});

// Delete a preview
router.delete('/api/preview/:idOrSlug', async (req, res) => {
  const idOrSlug = req.params.idOrSlug;
  
  // Try to determine if it's an ID or a slug
  let previewId = idOrSlug;
  
  // Check if it's in our slug lookup table
  if (slugLookupTable[idOrSlug]) {
    previewId = slugLookupTable[idOrSlug];
    
    // Remove from lookup table
    delete slugLookupTable[idOrSlug];
    console.log(`[SERVER] Removed slug ${idOrSlug} from lookup table`);
  } else {
    const parts = idOrSlug.split('-');
    const extractedId = parts[parts.length - 1];
    if (extractedId && extractedId.length >= 10) {
      previewId = extractedId;
    }
  }
  
  try {
    const previewPath = path.join(__dirname, `../../data/previews/${previewId}.json`);
    
    try {
      await fs.unlink(previewPath);
      console.log(`[SERVER] Deleted preview data for ID: ${previewId}`);
      res.json({ success: true });
    } catch (unlinkError) {
      console.log(`[SERVER] Preview data not found for deletion: ${previewId}`);
      res.status(404).json({ error: 'Preview not found' });
    }
  } catch (error) {
    console.error(`[SERVER] Error deleting preview data: ${error.message}`);
    res.status(500).json({ error: 'Error deleting preview data' });
  }
});

// Add a query parameter fallback route
router.get('/preview-fallback', async (req, res) => {
  const slug = req.query.id;
  
  console.log(`[SERVER] Preview fallback request for: ${slug}`);
  
  // Serve the viewer page
  res.sendFile(path.resolve(__dirname, '../../client/preview/viewer.html'));
});

// List of essential CSS files relative to the project root
// Adjust these paths based on your actual project structure!
const essentialCssFiles = [
    'client/output.css', // Tailwind
    // Example path if KaTeX installed via npm and served directly or copied to public
     'client/vendor/katex/katex.min.css', // Assuming you might copy it here? Adjust path as needed.
    // Or if served from node_modules (ensure your server setup allows this)
    // 'node_modules/katex/dist/katex.min.css',
    // Add paths to highlight.js themes or other preview-specific CSS here
    // 'client/vendor/highlight/styles/github-dark.css',
    // 'client/css/markdown-preview-theme.css',
];

// Helper function to check if a path is an HTTP/HTTPS URL
const isHttpUrl = (str) => {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false; // Not a valid URL format
  }
};

// --- Logging Helper ---
function logServer(message, level = 'info') {
    const logFunc = level === 'error' ? console.error : (level === 'warn' ? console.warn : console.log);
    logFunc(`[PREVIEW_API] ${message}`);
}

// --- Define Base/Essential CSS Resources ---
// Can include local paths (relative to project root) and full URLs
const basePreviewCssResources = [
    // 'client/output.css', // <<< REMOVED Tailwind CSS
            'https://cdn.jsdelivr.net/npm/katex@latest/dist/katex.min.css', // KaTeX CDN URL
    // Add other essential local paths or CDN URLs ONLY IF NEEDED for preview
];

// --- CSS Reading Function (Only for local files) ---
async function readLocalCssFile(relativePath, dataRootDir, projectRootDir) {
    try {
        let absolutePath;
        const normalizedPath = path.normalize(relativePath).replace(/^(\.\.[\/\\])+/, '');

        // Determine root based on path prefix
        if (normalizedPath.startsWith('client/')) {
            absolutePath = path.resolve(projectRootDir, normalizedPath);
             logServer(`Resolving LOCAL CSS relative to project root: ${absolutePath}`, 'debug');
        } else if (normalizedPath.startsWith('node_modules/')) {
             absolutePath = path.resolve(projectRootDir, normalizedPath);
             logServer(`Resolving LOCAL CSS relative to project node_modules: ${absolutePath}`, 'debug');
        } else {
             // Assume relative to data root (MD_DIR)
             if (!dataRootDir) throw new Error('Data root directory (MD_DIR) is not configured or available.');
             absolutePath = path.resolve(dataRootDir, normalizedPath);
             logServer(`Resolving LOCAL CSS relative to data root (${dataRootDir}): ${absolutePath}`, 'debug');
        }

        if (!absolutePath.startsWith(projectRootDir) && !absolutePath.startsWith(dataRootDir)) {
             throw new Error(`CSS path escape attempt detected: ${relativePath} resolved to ${absolutePath}`);
        }

        logServer(`Reading LOCAL CSS file: ${absolutePath}`);
        let content = await fs.readFile(absolutePath, 'utf-8');
        return { source: relativePath, content: content };
    } catch (error) {
        logServer(`Error reading LOCAL CSS file ${relativePath}: ${error.message}`, 'error');
        return { source: relativePath, content: `/* CSS File Read Error: ${relativePath} - ${error.message} */`, error: true };
    }
}

// --- Static HTML Generation Route (Modified for Links) ---
router.post('/generate-static', express.json({ limit: '10mb' }), async (req, res) => {
    logServer('Received request for POST /generate-static');
    try {
        const { filePath, markdownSource, renderedHtml, activeCssPaths } = req.body;

        if (!renderedHtml) {
            logServer('Missing renderedHtml in request body', 'error');
            return res.status(400).json({ error: 'Missing required field: renderedHtml' });
        }
        if (!req.pdata?.dataRoot) {
            logServer('dataRoot not found in req.pdata. This is needed for resolving some asset paths.', 'error');
            // Depending on strictness, you might return an error or proceed if only project-relative assets are expected.
            // For now, we'll proceed, but htmlGenerator might have issues with user-content paths.
        }
        
        // projectRootDir is defined at the top of previewRoutes.js
        // dataRootDir for htmlGenerator should be the user's content root (e.g., /root/pj/pd or MD_DIR)
        // If your `req.pdata.dataRoot` is `/root/pj/pd`, and user content (MD files) are in `/root/pj/pd/data`,
        // then htmlGenerator's dataRootDir might need to be path.join(req.pdata.dataRoot, 'data')
        // For now, let's assume req.pdata.dataRoot is the direct root for MD files for simplicity,
        // or that htmlGenerator handles the /data subdir internally if needed.
        // The crucial part is that `htmlGenerator` needs a `dataRootDir` that represents the base from which
        // paths like "observability/screenshots/screenshot-001.md" or CSS "styles.css" (if in dataRoot) are resolved.

        const htmlGeneratorOptions = {
            renderedHtml: renderedHtml,
            markdownSource: markdownSource,
            requestedCssPaths: req.body.cssFiles || [],
            originalFilePath: filePath,
            dataRootDir: req.pdata?.dataRoot,
            projectRootDir: projectRootDir,
            uploadsDir: req.pdata?.uploadsDir
        };

        // Simplified log message to avoid syntax errors
        logServer('Calling generateStaticHtml with some options...', 'debug'); 
        // console.log('DEBUG htmlGeneratorOptions:', htmlGeneratorOptions); // Alternative direct console log for debugging if needed
        
        const finalHtmlContent = await generateStaticHtml(htmlGeneratorOptions);

        logServer(`Static HTML generated by htmlGenerator.js (length: ${finalHtmlContent.length}). Sending response.`);
        res.setHeader('Content-Type', 'text/html');
        res.send(finalHtmlContent);
    } catch (error) {
        console.error(`[SERVER] Error generating static HTML: ${error.message}`);
        res.status(500).json({ error: 'Error generating static HTML' });
    }
});

export default router;
