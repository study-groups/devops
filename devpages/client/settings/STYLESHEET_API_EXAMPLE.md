# Stylesheet Proxy API Example

This document provides an example implementation for a server-side API endpoint that can safely fetch external stylesheets for the System CSS panel.

## Problem

External stylesheets cannot be fetched directly from the browser due to CORS restrictions and security policies. The System CSS panel shows:

```
/* External stylesheet: https://devpages.qa.pixeljamarcade.com/client/styles/design-system.css */
/* Content cannot be displayed for security reasons */
```

## Solution

Implement a server-side proxy endpoint that can fetch external stylesheets with proper security controls.

## API Endpoint

### GET `/api/stylesheets/proxy`

**Query Parameters:**
- `url` (required): The URL of the stylesheet to fetch (URL-encoded)

**Example Request:**
```
GET /api/stylesheets/proxy?url=https%3A//devpages.qa.pixeljamarcade.com/client/styles/design-system.css
```

**Response:**
```json
{
  "success": true,
  "url": "https://devpages.qa.pixeljamarcade.com/client/styles/design-system.css",
  "content": "/* CSS content here */",
  "contentType": "text/css",
  "size": 12345,
  "cached": false
}
```

## Implementation Example (Node.js/Express)

```javascript
const express = require('express');
const fetch = require('node-fetch');
const { URL } = require('url');

const router = express.Router();

// Allowed domains for stylesheet fetching
const ALLOWED_DOMAINS = [
  'devpages.qa.pixeljamarcade.com',
  'pixeljamarcade.com',
  'localhost',
  '127.0.0.1'
];

// Cache for fetched stylesheets (in production, use Redis or similar)
const stylesheetCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

router.get('/api/stylesheets/proxy', async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL parameter is required'
      });
    }

    // Validate URL
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL format'
      });
    }

    // Check if domain is allowed
    const isAllowed = ALLOWED_DOMAINS.some(domain => 
      parsedUrl.hostname === domain || 
      parsedUrl.hostname.endsWith('.' + domain)
    );

    if (!isAllowed) {
      return res.status(403).json({
        success: false,
        error: 'Domain not allowed'
      });
    }

    // Check cache first
    const cacheKey = url;
    const cached = stylesheetCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return res.json({
        success: true,
        url,
        content: cached.content,
        contentType: cached.contentType,
        size: cached.content.length,
        cached: true
      });
    }

    // Fetch the stylesheet
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'DevPages-StylesheetProxy/1.0',
        'Accept': 'text/css,*/*;q=0.1'
      },
      timeout: 10000 // 10 second timeout
    });

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`
      });
    }

    const contentType = response.headers.get('content-type') || 'text/css';
    const content = await response.text();

    // Basic CSS validation (optional)
    if (content.length > 1024 * 1024) { // 1MB limit
      return res.status(413).json({
        success: false,
        error: 'Stylesheet too large (max 1MB)'
      });
    }

    // Cache the result
    stylesheetCache.set(cacheKey, {
      content,
      contentType,
      timestamp: Date.now()
    });

    // Clean up old cache entries periodically
    if (stylesheetCache.size > 100) {
      const now = Date.now();
      for (const [key, value] of stylesheetCache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
          stylesheetCache.delete(key);
        }
      }
    }

    res.json({
      success: true,
      url,
      content,
      contentType,
      size: content.length,
      cached: false
    });

  } catch (error) {
    console.error('Stylesheet proxy error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;
```

## Security Considerations

1. **Domain Whitelist**: Only allow fetching from trusted domains
2. **Size Limits**: Prevent fetching extremely large files
3. **Timeout**: Set reasonable timeouts to prevent hanging requests
4. **Rate Limiting**: Implement rate limiting to prevent abuse
5. **Content Validation**: Basic validation of CSS content
6. **Caching**: Cache results to reduce external requests
7. **Error Handling**: Proper error responses without exposing internal details

## Frontend Integration

Update the SystemCssPanel to use the API:

```javascript
async fetchExternalStylesheetContent(stylesheet) {
  try {
    const apiUrl = `/api/stylesheets/proxy?url=${encodeURIComponent(stylesheet.href)}`;
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Unknown API error');
    }
    
    return data.content;
  } catch (error) {
    logSystemCss(`Failed to fetch via API: ${error.message}`, 'error');
    throw error;
  }
}
```

## Benefits

- ✅ Secure server-side fetching
- ✅ CORS compliance
- ✅ Domain whitelisting
- ✅ Caching for performance
- ✅ Size and timeout limits
- ✅ Proper error handling
- ✅ Easy to extend and maintain 