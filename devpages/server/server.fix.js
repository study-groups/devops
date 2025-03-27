// Copy just the publish routes directly into your server.js

// Check if a file is published
app.get('/api/is-published', async (req, res) => {
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

// Publish a file
app.post('/api/publish', express.json(), async (req, res) => {
  try {
    const { dir, file, content } = req.body;
    
    if (!dir || !file) {
      return res.status(400).json({ error: 'Directory and file name are required' });
    }
    
    // Create a hash for this dir/file combination
    const hash = createHash(dir, file);
    const urlName = getUrlName(file);
    
    // Save the content to a published directory
    const publishDir = path.join(__dirname, '../data/published');
    
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
app.post('/api/unpublish', express.json(), async (req, res) => {
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
      await fs.unlink(path.join(__dirname, `../data/published/${hash}.md`));
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