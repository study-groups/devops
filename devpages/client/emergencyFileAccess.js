// Add this new file for emergency file access when server routes are failing
export async function emergencyFileAccess(directory, filename) {
  try {
    console.log(`[EMERGENCY] Attempting direct file access for ${directory}/${filename}`);
    
    // Try direct URL access
    const response = await fetch(`/${directory}/${filename}`);
    
    if (response.ok) {
      return await response.text();
    }
    
    // Check local storage as a last resort
    const storageKey = `file_content_${directory}_${filename}`;
    const cachedContent = localStorage.getItem(storageKey);
    
    if (cachedContent) {
      console.log('[EMERGENCY] Found cached content');
      return cachedContent;
    }
    
    // Nothing worked
    throw new Error('No file content found');
  } catch (error) {
    console.error('[EMERGENCY] File access failed:', error);
    throw error;
  }
} 