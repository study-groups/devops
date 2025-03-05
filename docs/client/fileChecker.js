/**
 * fileChecker.js - Utility to check if files can be loaded from various paths
 */

// List of paths to test
const pathsToTest = [
  '/client/authManager.js',
  './authManager.js',
  '../authManager.js',
  '/authManager.js',
  'authManager.js',
  // Add other variations as needed
];

/**
 * Tests if a file can be fetched from a given path
 * @param {string} path - Path to test
 * @returns {Promise<{path: string, status: string, ok: boolean}>} Result of the fetch attempt
 */
async function testPath(path) {
  try {
    console.log(`[FILE_CHECK] Testing path: ${path}`);
    const response = await fetch(path);
    
    return {
      path,
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: Array.from(response.headers.entries()).reduce((obj, [key, val]) => {
        obj[key] = val;
        return obj;
      }, {})
    };
  } catch (error) {
    return {
      path,
      status: 'ERROR',
      statusText: error.message,
      ok: false,
      error: error.toString()
    };
  }
}

/**
 * Tests all paths and reports the results
 */
export async function checkFilePaths() {
  console.log('[FILE_CHECK] Starting file path diagnostics...');
  console.log(`[FILE_CHECK] Origin: ${window.location.origin}`);
  console.log(`[FILE_CHECK] Current URL: ${window.location.href}`);
  
  const results = await Promise.all(pathsToTest.map(testPath));
  
  console.log('=== FILE PATH DIAGNOSTICS RESULTS ===');
  results.forEach(result => {
    console.log(`Path: ${result.path}`);
    console.log(`Status: ${result.status} ${result.statusText}`);
    console.log(`Success: ${result.ok ? 'YES ✅' : 'NO ❌'}`);
    if (result.headers) {
      console.log('Headers:', result.headers);
    }
    if (result.error) {
      console.log('Error:', result.error);
    }
    console.log('-----------------------------------');
  });
  
  // Find and report the first successful path
  const successfulPath = results.find(r => r.ok);
  if (successfulPath) {
    console.log(`[FILE_CHECK] ✅ Found working path: ${successfulPath.path}`);
    return successfulPath.path;
  } else {
    console.log('[FILE_CHECK] ❌ No working paths found!');
    return null;
  }
}

// Make it available globally
window.checkFilePaths = checkFilePaths;

// Auto-run check when loaded directly
if (window.location.pathname.endsWith('fileChecker.js')) {
  checkFilePaths();
}

export default { checkFilePaths }; 