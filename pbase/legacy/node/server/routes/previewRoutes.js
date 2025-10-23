import express from 'express';
import { Router } from 'express';
import path from 'path';
import { promises as fs } from 'fs';
import playwright from 'playwright';
import { fileURLToPath } from 'url';

// Import config with .js extension
import { port } from '../config.js';

// Derive __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// API endpoint to generate static HTML using Playwright
router.get('/api/preview/static-html', async (req, res) => {
  console.log(`[SERVER] Static HTML generation request received.`);
  let browser = null;
  try {
    // Launch the browser (Chromium is often a good default)
    browser = await playwright.chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    // Construct the base URL using the configured port
    // Ensure process.env.NODE_ENV is checked for proper http/https handling if needed
    const baseUrl = `http://localhost:${port}`;
    const targetUrl = `${baseUrl}/`; // Target the root page

    console.log(`[SERVER] Navigating to ${targetUrl} for HTML capture...`);

    // Navigate to the page and wait for it to be fully loaded
    await page.goto(targetUrl, { waitUntil: 'networkidle' }); 
    // 'networkidle' waits until there are no network connections for 500 ms.
    // This might need adjustment based on how your SPA loads data.

    console.log(`[SERVER] Page loaded, extracting HTML...`);

    // Get the full HTML content of the page
    const htmlContent = await page.content();

    console.log(`[SERVER] HTML extracted successfully.`);

    // Set headers for file download
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', 'attachment; filename="preview.html"');

    // Send the HTML content
    res.send(htmlContent);

  } catch (error) {
    console.error(`[SERVER] Error generating static HTML: ${error.message}`);
    console.error(error.stack); // Log the full stack trace
    res.status(500).json({ 
        error: 'Failed to generate static HTML preview.',
        details: error.message 
    });
  } finally {
    // Ensure the browser is closed even if an error occurs
    if (browser) {
      console.log(`[SERVER] Closing Playwright browser.`);
      await browser.close();
    }
  }
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

export default router; 