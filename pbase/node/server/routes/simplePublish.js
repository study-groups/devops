const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const { authMiddleware } = require('../middleware/auth');

// Path to the published files registry
const REGISTRY_PATH = path.join(__dirname, '../../data/published-files.json');

// Ensure the registry file exists
async function ensureRegistry() {
  try {
    await fs.access(REGISTRY_PATH);
  } catch (error) {
    // Create directory if it doesn't exist
    try {
      await fs.mkdir(path.dirname(REGISTRY_PATH), { recursive: true });
    } catch (mkdirError) {
      // Directory already exists, ignore
    }
    
    // Create empty registry file
    await fs.writeFile(REGISTRY_PATH, JSON.stringify({}, null, 2));
  }
}

// Load the registry
async function loadRegistry() {
  await ensureRegistry();
  
  try {
    const data = await fs.readFile(REGISTRY_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('[PUBLISH] Error loading registry:', error);
    return {};
  }
}

// Save the registry
async function saveRegistry(registry) {
  try {
    await fs.writeFile(REGISTRY_PATH, JSON.stringify(registry, null, 2));
  } catch (error) {
    console.error('[PUBLISH] Error saving registry:', error);
    throw new Error('Failed to save publish registry');
  }
}

// Create a hash for the directory and file
function createHash(dir, file) {
  // Simple hash function for demo purposes
  // In production, use a more robust algorithm
  const combined = `${dir}/${file}`;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash &= hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

// Get a URL-friendly name from the file
function getUrlName(fileName) {
  // Remove extension
  const baseName = fileName.replace(/\.[^/.]+$/, '');
  
  // Convert to URL-friendly format
  return baseName
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50);
}

// Add this test endpoint at the top of your file
router.get('/publish-test', (req, res) => {
  res.json({
    success: true,
    message: 'Publish routes are working',
    time: new Date().toISOString()
  });
});

// Add this at the top of your routes file
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Publish API routes are working',
    time: new Date().toISOString(),
    routes: router.stack.map(layer => {
      if (layer.route) {
        return {
          path: layer.route.path,
          methods: Object.keys(layer.route.methods)
        };
      }
      return null;
    }).filter(Boolean)
  });
});

// Publish a file
router.post('/publish', express.json(), async (req, res) => {
  try {
    const { dir, file, content } = req.body;
    
    if (!dir || !file) {
      return res.status(400).json({ error: 'Directory and file name are required' });
    }
    
    // Create a hash for this dir/file combination
    const hash = createHash(dir, file);
    const urlName = getUrlName(file);
    
    // Save the content to a published directory
    const publishDir = path.join(__dirname, '../../data/published');
    
    try {
      await fs.mkdir(publishDir, { recursive: true });
    } catch (mkdirError) {
      // Directory already exists, ignore
    }
    
    // Save the content
    await fs.writeFile(path.join(publishDir, `${hash}.md`), content);
    
    // Update the registry
    const registry = await loadRegistry();
    registry[`${dir}/${file}`] = {
      hash,
      urlName,
      publishedAt: new Date().toISOString(),
      fileName: file
    };
    
    await saveRegistry(registry);
    
    // Create the URL
    const url = `${req.protocol}://${req.get('host')}/view/${urlName}/${hash}`;
    
    res.json({
      success: true,
      hash,
      url
    });
  } catch (error) {
    console.error('[PUBLISH] Error publishing file:', error);
    res.status(500).json({ error: error.message });
  }
});

// Unpublish a file
router.post('/unpublish', express.json(), async (req, res) => {
  try {
    const { dir, file } = req.body;
    
    if (!dir || !file) {
      return res.status(400).json({ error: 'Directory and file name are required' });
    }
    
    // Load the registry
    const registry = await loadRegistry();
    const key = `${dir}/${file}`;
    
    // Check if the file is published
    if (!registry[key]) {
      return res.status(404).json({ error: 'File not published' });
    }
    
    // Get the hash
    const hash = registry[key].hash;
    
    // Delete the published file
    try {
      await fs.unlink(path.join(__dirname, `../../data/published/${hash}.md`));
    } catch (unlinkError) {
      console.error('[PUBLISH] Error deleting published file:', unlinkError);
      // Continue even if file deletion fails
    }
    
    // Remove from registry
    delete registry[key];
    await saveRegistry(registry);
    
    res.json({ success: true });
  } catch (error) {
    console.error('[PUBLISH] Error unpublishing file:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check if a file is published
router.get('/is-published', async (req, res) => {
  try {
    const { dir, file } = req.query;
    
    if (!dir || !file) {
      return res.status(400).json({ error: 'Directory and file name are required' });
    }
    
    // Load the registry
    const registry = await loadRegistry();
    const key = `${dir}/${file}`;
    
    // Check if the file is published
    if (registry[key]) {
      const hash = registry[key].hash;
      const urlName = registry[key].urlName;
      const url = `${req.protocol}://${req.get('host')}/view/${urlName}/${hash}`;
      
      res.json({
        published: true,
        hash,
        url
      });
    } else {
      res.json({ published: false });
    }
  } catch (error) {
    console.error('[PUBLISH] Error checking publish status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Route for viewing published content
router.get('/view/:name/:hash', async (req, res) => {
  try {
    const { name, hash } = req.params;
    
    // Validate hash (simple security check)
    if (!/^[0-9a-f]+$/.test(hash)) {
      return res.status(400).send('Invalid hash format');
    }
    
    // Check if the file exists
    const filePath = path.join(__dirname, `../../data/published/${hash}.md`);
    
    try {
      await fs.access(filePath);
    } catch (accessError) {
      return res.status(404).send('Published file not found');
    }
    
    // Get the file content
    const content = await fs.readFile(filePath, 'utf8');
    
    // Find the original file name from the registry
    const registry = await loadRegistry();
    let fileName = name;
    
    // Look through registry to find the matching hash
    for (const key in registry) {
      if (registry[key].hash === hash) {
        fileName = registry[key].fileName;
        break;
      }
    }
    
    // Serve the viewer page
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${fileName}</title>
        <style>
          body {
            font-family: -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background: #f8f9fa;
          }
          
          .top-bar {
            background: #fff;
            border-bottom: 1px solid #ddd;
            padding: 15px 20px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            text-align: center;
          }
          
          .top-bar h1 {
            margin: 0;
            font-size: 18px;
            font-weight: 500;
          }
          
          .content {
            max-width: 800px;
            margin: 20px auto;
            padding: 20px;
            background: #fff;
            border-radius: 5px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }
          
          /* Basic Markdown Styling */
          .content h1, .content h2, .content h3, .content h4 {
            margin-top: 1.5em;
            margin-bottom: 0.5em;
          }
          
          .content h1 { font-size: 2em; }
          .content h2 { font-size: 1.5em; }
          .content h3 { font-size: 1.17em; }
          
          .content p {
            margin: 1em 0;
          }
          
          .content code {
            background: #f0f0f0;
            padding: 2px 4px;
            border-radius: 3px;
            font-family: monospace;
          }
          
          .content pre {
            background: #f0f0f0;
            padding: 10px;
            border-radius: 5px;
            overflow-x: auto;
          }
          
          .content blockquote {
            border-left: 4px solid #ddd;
            padding-left: 1em;
            margin-left: 0;
            color: #666;
          }
          
          .content img {
            max-width: 100%;
          }
          
          .content table {
            border-collapse: collapse;
            width: 100%;
          }
          
          .content table, .content th, .content td {
            border: 1px solid #ddd;
            padding: 8px;
          }
          
          .content th {
            background-color: #f2f2f2;
          }
        </style>
      </head>
      <body>
        <div class="top-bar">
          <h1>${fileName}</h1>
        </div>
        
        <div class="content" id="content"></div>
        
        <script>
          // Super simple markdown renderer
          function renderMarkdown(text) {
            return text
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/^# (.*?)$/gm, '<h1>$1</h1>')
              .replace(/^## (.*?)$/gm, '<h2>$1</h2>')
              .replace(/^### (.*?)$/gm, '<h3>$1</h3>')
              .replace(/^#### (.*?)$/gm, '<h4>$1</h4>')
              .replace(/^\* (.*?)$/gm, '<li>$1</li>')
              .replace(/^- (.*?)$/gm, '<li>$1</li>')
              .replace(/^\d+\. (.*?)$/gm, '<li>$1</li>')
              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
              .replace(/\*(.*?)\*/g, '<em>$1</em>')
              .replace(/\`\`\`(.*?)\`\`\`/gs, '<pre><code>$1</code></pre>')
              .replace(/\`(.*?)\`/g, '<code>$1</code>')
              .replace(/!\[(.*?)\]\((.*?)\)/g, '<img alt="$1" src="$2">')
              .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')
              .replace(/\n\n/g, '</p><p>')
              .replace(/\n/g, '<br>');
          }
          
          // Render the markdown content
          document.getElementById('content').innerHTML = '<p>' + renderMarkdown(${JSON.stringify(content)}) + '</p>';
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('[VIEW] Error serving published file:', error);
    res.status(500).send('Error loading published content');
  }
});

module.exports = router;
module.exports.createHash = createHash;
module.exports.getUrlName = getUrlName;
module.exports.loadRegistry = loadRegistry;
module.exports.saveRegistry = saveRegistry; 