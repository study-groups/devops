/**
 * API service for publish operations
 */
import { globalFetch } from '/client/globalFetch.js';
import { logMessage } from '/client/log/index.js';

export class PublishAPI {
  // Modified to use existing endpoints for testing
  static async testSetup() {
    const startTime = Date.now();
    const results = {
      spacesConfig: null,
      publishEndpoint: null,
      overallStatus: 'unknown'
    };

    try {
      logMessage('Testing setup with existing endpoints...', 'info', 'PUBLISH_API');
      
      // Test 1: Check Spaces configuration
      try {
        const configResponse = await globalFetch('/api/spaces/config');
        const configTime = Date.now() - startTime;
        
        if (configResponse.ok) {
          const configData = await configResponse.json();
          results.spacesConfig = {
            status: 'success',
            responseTime: configTime,
            config: configData.config
          };
          
          // Check if config is complete
          const config = configData.config;
          const isComplete = config.endpointValue !== 'Not Set' && 
                           config.regionValue !== 'Not Set' && 
                           config.bucketValue !== 'Not Set';
          
          if (!isComplete) {
            results.spacesConfig.status = 'incomplete';
            results.spacesConfig.missing = [];
            if (config.endpointValue === 'Not Set') results.spacesConfig.missing.push('endpoint');
            if (config.regionValue === 'Not Set') results.spacesConfig.missing.push('region');
            if (config.bucketValue === 'Not Set') results.spacesConfig.missing.push('bucket');
          }
        } else {
          results.spacesConfig = {
            status: 'error',
            responseTime: configTime,
            error: `HTTP ${configResponse.status}`
          };
        }
      } catch (configError) {
        results.spacesConfig = {
          status: 'error',
          error: configError.message
        };
      }

      // Test 2: Check publish endpoint with a dummy query
      try {
        const publishResponse = await globalFetch('/api/publish?pathname=test.md');
        const publishTime = Date.now() - startTime;
        
        if (publishResponse.ok) {
          results.publishEndpoint = {
            status: 'success',
            responseTime: publishTime - (results.spacesConfig?.responseTime || 0)
          };
        } else {
          results.publishEndpoint = {
            status: 'error',
            responseTime: publishTime - (results.spacesConfig?.responseTime || 0),
            error: `HTTP ${publishResponse.status}`
          };
        }
      } catch (publishError) {
        results.publishEndpoint = {
          status: 'error',
          error: publishError.message
        };
      }

      // Determine overall status
      const totalTime = Date.now() - startTime;
      
      if (results.spacesConfig?.status === 'success' && 
          results.publishEndpoint?.status === 'success') {
        results.overallStatus = 'success';
        return {
          success: true,
          message: `Setup looks good! (${totalTime}ms)`,
          details: {
            responseTime: totalTime,
            spacesEndpoint: results.spacesConfig.config?.endpointValue,
            tests: results
          }
        };
      } else if (results.spacesConfig?.status === 'incomplete') {
        results.overallStatus = 'incomplete';
        return {
          success: false,
          message: `Configuration incomplete`,
          details: {
            responseTime: totalTime,
            missing: results.spacesConfig.missing,
            tests: results
          }
        };
      } else {
        results.overallStatus = 'error';
        const errors = [];
        if (results.spacesConfig?.error) errors.push(`Config: ${results.spacesConfig.error}`);
        if (results.publishEndpoint?.error) errors.push(`Publish: ${results.publishEndpoint.error}`);
        
        throw new Error(`Setup issues detected: ${errors.join(', ')}`);
      }
      
    } catch (error) {
      logMessage(`Setup test failed: ${error.message}`, 'error', 'PUBLISH_API');
      throw new Error(`Setup test failed: ${error.message}`);
    }
  }

  static async checkStatus(pathname) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    try {
      const response = await globalFetch(`/api/publish?pathname=${encodeURIComponent(pathname)}`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        return {
          isPublished: data.isPublished || false,
          url: data.url || null
        };
      } else {
        logMessage('Failed to check publish status', 'warn', 'PUBLISH_API');
        return { isPublished: false, url: null };
      }
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        logMessage('Status check timed out', 'warn', 'PUBLISH_API');
      }
      return { isPublished: false, url: null };
    }
  }

  static async publish(pathname, htmlContent, bundleCss = true, onProgress = null) {
    // Validate request before sending
    try {
      this.validatePublishRequest(pathname, htmlContent, bundleCss);
      logMessage('✅ Request validation passed', 'debug', 'PUBLISH_API');
    } catch (validationError) {
      logMessage(`❌ Request validation failed: ${validationError.message}`, 'error', 'PUBLISH_API');
      throw validationError;
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    try {
      if (onProgress) onProgress('🔄 Validating content...');
      
      const sizeMB = (htmlContent.length / (1024 * 1024)).toFixed(2);
      const sizeKB = Math.round(htmlContent.length / 1024);
      logMessage(`📤 Publishing ${sizeKB}KB to ${pathname}`, 'info', 'PUBLISH_API');
      
      // Log the actual request being sent for debugging
      const requestBody = {
        pathname,
        htmlContent: htmlContent.substring(0, 200) + '...', // Truncated for logging
        bundleCss,
        contentLength: htmlContent.length
      };
      logMessage(`📋 Request payload: ${JSON.stringify(requestBody, null, 2)}`, 'debug', 'PUBLISH_API');
      
      if (onProgress) onProgress(`📤 Uploading ${sizeKB}KB...`);
      
      const startTime = Date.now();
      
      const response = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pathname,
          htmlContent,
          bundleCss
        }),
        signal: controller.signal
      });

      const responseTime = Date.now() - startTime;
      clearTimeout(timeoutId);
      
      logMessage(`📡 Server responded with ${response.status} in ${responseTime}ms`, 'debug', 'PUBLISH_API');
      
      // Always try to read the response body for error details
      const responseText = await response.text();
      logMessage(`📄 Response body: ${responseText.substring(0, 500)}`, 'debug', 'PUBLISH_API');
      
      if (response.status === 400) {
        let errorMessage = 'Bad Request (400)';
        
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.error || errorData.message || 'Request validation failed';
          
          logMessage(`❌ 400 Error details: ${JSON.stringify(errorData, null, 2)}`, 'error', 'PUBLISH_API');
          
          // Provide specific guidance based on error content
          let guidance = '\n\n🔧 Possible fixes:\n';
          if (errorMessage.includes('pathname')) {
            guidance += '- Check pathname format and encoding\n';
          }
          if (errorMessage.includes('htmlContent')) {
            guidance += '- Check HTML content format and size\n';
          }
          if (errorMessage.includes('required')) {
            guidance += '- Check all required fields are present\n';
          }
          if (errorMessage.includes('permission')) {
            guidance += '- Check file permissions in pdata system\n';
          }
          
          throw new Error(`❌ ${errorMessage}${guidance}`);
          
        } catch (parseError) {
          if (parseError.message.startsWith('❌')) {
            throw parseError; // Re-throw our formatted error
          }
          
          // If we can't parse the error response
          throw new Error(`❌ Bad Request (400): ${responseText.substring(0, 200)}\n\n🔧 Check server logs for validation details.`);
        }
      }
      
      if (response.status === 504) {
        throw new Error(`🚨 SERVER TIMEOUT (504) - S3 operations hanging. Check server-side S3 configuration.`);
      }
      
      if (response.status === 502) {
        throw new Error(`🚨 SERVER ERROR (502) - Server crashed. Check server logs for errors.`);
      }

      if (!response.ok) {
        throw new Error(`❌ HTTP ${response.status}: ${response.statusText}\n\nResponse: ${responseText.substring(0, 200)}`);
      }
      
      if (onProgress) onProgress('📝 Processing response...');
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (jsonError) {
        throw new Error(`Server returned invalid JSON: ${responseText.substring(0, 300)}`);
      }

      if (!data.success || !data.url) {
        throw new Error(data.error || 'Publish succeeded but no URL returned');
      }

      logMessage(`✅ Published in ${responseTime}ms: ${data.url}`, 'info', 'PUBLISH_API');
      return { success: true, url: data.url, responseTime };
      
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`⏱️ Request cancelled after 25 seconds.`);
      }
      throw error;
    }
  }

  static async unpublish(pathname) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch('/api/publish', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pathname }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const responseText = await response.text();
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (jsonError) {
        throw new Error(`Server returned invalid JSON: ${responseText.substring(0, 200)}...`);
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || `Server error: ${response.status} ${response.statusText}`);
      }

      return { success: true };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Unpublish request timed out after 15 seconds. Please try again.');
      }
      throw error;
    }
  }

  static async getSpacesConfig() {
    try {
      const response = await globalFetch('/api/spaces/config');
      if (response.ok) {
        const data = await response.json();
        return data.config;
      } else {
        logMessage('Failed to load Spaces configuration', 'warn', 'PUBLISH_API');
        return null;
      }
    } catch (error) {
      logMessage(`Error loading Spaces config: ${error.message}`, 'error', 'PUBLISH_API');
      return null;
    }
  }

  // Add this method to test with minimal content
  static async testPublish() {
    const testContent = `<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body><h1>Test Publish</h1><p>This is a minimal test.</p></body>
</html>`;
    
    const testPathname = `test-${Date.now()}.md`;
    
    try {
      logMessage('Testing publish with minimal content...', 'info', 'PUBLISH_API');
      const result = await this.publish(testPathname, testContent, false);
      
      // Clean up the test file
      try {
        await this.unpublish(testPathname);
        logMessage('Test file cleaned up', 'debug', 'PUBLISH_API');
      } catch (cleanupError) {
        logMessage(`Test cleanup failed: ${cleanupError.message}`, 'warn', 'PUBLISH_API');
      }
      
      return {
        success: true,
        message: `Test publish successful in ${result.responseTime}ms`,
        details: result
      };
    } catch (error) {
      throw new Error(`Test publish failed: ${error.message}`);
    }
  }

  // Add a method to test different aspects of the publish endpoint
  static async debugPublishEndpoint() {
    const results = {
      postReachable: false,
      postWithEmptyBody: false,
      postWithMinimalBody: false,
      serverProcessingTime: null,
      errorDetails: null
    };

    try {
      logMessage('🔍 Starting comprehensive publish endpoint debugging...', 'info', 'PUBLISH_API');

      // Test 1: Can we reach the POST endpoint at all?
      try {
        logMessage('Test 1: Testing if POST /api/publish is reachable...', 'debug', 'PUBLISH_API');
        const startTime = Date.now();
        
        const response = await fetch('/api/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}), // Empty body
          signal: AbortSignal.timeout(10000) // 10 second timeout
        });
        
        const responseTime = Date.now() - startTime;
        const responseText = await response.text();
        
        results.postReachable = true;
        results.serverProcessingTime = responseTime;
        
        logMessage(`✅ POST endpoint reachable in ${responseTime}ms, status: ${response.status}`, 'info', 'PUBLISH_API');
        logMessage(`📄 Response body: ${responseText}`, 'debug', 'PUBLISH_API');
        
        if (response.status === 400) {
          // Parse the 400 error details
          try {
            const errorData = JSON.parse(responseText);
            results.errorDetails = errorData;
            logMessage(`📋 400 Error parsed: ${JSON.stringify(errorData, null, 2)}`, 'debug', 'PUBLISH_API');
          } catch (parseError) {
            results.errorDetails = { rawError: responseText };
            logMessage(`📋 400 Error (raw): ${responseText}`, 'debug', 'PUBLISH_API');
          }
        }
        
        results.postWithEmptyBody = response.ok || response.status === 400; // 400 is expected for empty body
        
      } catch (postError) {
        logMessage(`❌ POST endpoint test failed: ${postError.message}`, 'error', 'PUBLISH_API');
        if (postError.name === 'TimeoutError') {
          throw new Error(`POST /api/publish endpoint is still hanging (10s timeout).`);
        }
        throw postError;
      }

      // Test 2: Try with minimal valid payload
      try {
        logMessage('Test 2: Testing with minimal valid payload...', 'debug', 'PUBLISH_API');
        const startTime = Date.now();
        
        const testPayload = {
          pathname: 'debug-test.md',
          htmlContent: '<html><body>test</body></html>',
          bundleCss: false
        };
        
        logMessage(`📤 Sending test payload: ${JSON.stringify(testPayload, null, 2)}`, 'debug', 'PUBLISH_API');
        
        const response = await fetch('/api/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testPayload),
          signal: AbortSignal.timeout(15000) // 15 second timeout
        });
        
        const responseTime = Date.now() - startTime;
        const responseText = await response.text();
        
        logMessage(`📡 Minimal payload test: ${responseTime}ms, status: ${response.status}`, 'info', 'PUBLISH_API');
        logMessage(`📄 Response: ${responseText}`, 'debug', 'PUBLISH_API');
        
        results.postWithMinimalBody = response.ok;
        
        if (response.status === 400) {
          // Parse the 400 error for minimal payload
          try {
            const errorData = JSON.parse(responseText);
            results.minimalPayloadError = errorData;
            
            return {
              success: false,
              message: `400 Bad Request with valid payload`,
              details: {
                responseTime: responseTime,
                errorMessage: errorData.error || errorData.message || 'Unknown validation error',
                fullError: errorData,
                testPayload: testPayload,
                serverResponse: responseText
              }
            };
            
          } catch (parseError) {
            return {
              success: false,
              message: `400 Bad Request - unparseable response`,
              details: {
                responseTime: responseTime,
                rawResponse: responseText,
                testPayload: testPayload
              }
            };
          }
        } else if (response.ok) {
          const data = JSON.parse(responseText);
          logMessage(`✅ Minimal publish worked! URL: ${data.url}`, 'info', 'PUBLISH_API');
          
          // Clean up test file
          try {
            await this.unpublish('debug-test.md');
          } catch (cleanupError) {
            logMessage(`Cleanup failed: ${cleanupError.message}`, 'warn', 'PUBLISH_API');
          }
          
          return {
            success: true,
            message: 'All tests passed - publish is working!',
            details: {
              responseTime: responseTime,
              publishedUrl: data.url
            }
          };
        } else {
          return {
            success: false,
            message: `HTTP ${response.status}: ${response.statusText}`,
            details: {
              responseTime: responseTime,
              status: response.status,
              statusText: response.statusText,
              response: responseText
            }
          };
        }
        
      } catch (minimalError) {
        logMessage(`❌ Minimal payload test failed: ${minimalError.message}`, 'error', 'PUBLISH_API');
        if (minimalError.name === 'TimeoutError') {
          throw new Error(`Server still hanging with minimal payload (15s timeout).`);
        }
        throw minimalError;
      }

    } catch (error) {
      return {
        success: false,
        message: error.message,
        details: results
      };
    }
  }

  // Add this method to test server health
  static async testServerHealth() {
    try {
      // Test with a simple GET request to see if server is responsive
      const healthResponse = await fetch('/api/spaces/config', {
        signal: AbortSignal.timeout(3000)
      });
      
      if (healthResponse.ok) {
        logMessage('✅ Server is responsive to GET requests', 'info', 'PUBLISH_API');
        
        // Now test if server accepts POST requests at all
        const postTestResponse = await fetch('/api/spaces/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
          signal: AbortSignal.timeout(3000)
        });
        
        // We expect this to fail (405 Method Not Allowed), but it should fail quickly
        logMessage(`POST test to /api/spaces/config: ${postTestResponse.status} (${postTestResponse.statusText})`, 'debug', 'PUBLISH_API');
        
        return {
          serverResponsive: true,
          postSupported: postTestResponse.status !== 0 // 0 means timeout/connection failed
        };
      } else {
        return {
          serverResponsive: false,
          error: `Server returned ${healthResponse.status}`
        };
      }
    } catch (error) {
      return {
        serverResponsive: false,
        error: error.message
      };
    }
  }

  // Add this helper method to validate the request before sending
  static validatePublishRequest(pathname, htmlContent, bundleCss) {
    const errors = [];
    
    if (!pathname || typeof pathname !== 'string') {
      errors.push('pathname must be a non-empty string');
    }
    
    if (!htmlContent || typeof htmlContent !== 'string') {
      errors.push('htmlContent must be a non-empty string');
    }
    
    if (typeof bundleCss !== 'boolean') {
      errors.push('bundleCss must be a boolean');
    }
    
    if (pathname && pathname.length > 500) {
      errors.push('pathname is too long (max 500 chars)');
    }
    
    if (htmlContent && htmlContent.length > 50 * 1024 * 1024) { // 50MB limit
      errors.push('htmlContent is too large (max 50MB)');
    }
    
    // Check for potentially problematic characters
    if (pathname && !/^[a-zA-Z0-9._/\-]+$/.test(pathname)) {
      errors.push('pathname contains invalid characters (only alphanumeric, dots, slashes, hyphens allowed)');
    }
    
    if (errors.length > 0) {
      throw new Error(`❌ Request validation failed:\n${errors.map(e => `- ${e}`).join('\n')}`);
    }
    
    return true;
  }
} 