# PJA Style SDK & Iframer Component Conventions

## Overview

The PJA (PixelJam Arcade) Style SDK provides a standardized communication bridge between iframe content (`*.iframe.html`) and their host pages. This system enables seamless integration of scrollbar styling, title management, and custom interactions.

## File Naming Convention

- **Iframe files**: Must use the pattern `*.iframe.html` to automatically initialize the PJA Style SDK
- **Host files**: Include `pja-iframer.js` to manage iframe communication

## PJA Style SDK (Iframe Side)

### Auto-Initialization
The SDK automatically initializes for any `*.iframe.html` file:
```html
<script src="pja-style-sdk.js"></script>
```

### Title Conventions
Use one of these elements for automatic title detection:
```html
<h1 class="pja-title">Your Title</h1>
<h1 data-pja-title>Your Title</h1>
<div class="pja-title">Your Title</div>
```

### Configuration
* **PD_DIR**: The primary data directory.
* **PW_DIR**: The Playwright project directory.

### Configuration
* All configurations are stored in `playwright/config`.
* Environment-specific configurations are named `playwright.config.{env}.js`.
* The main configuration file is `playwright.config.js`.

### Logging

### API Methods
```javascript
// Title management
window.PJA.setTitle('New Title');
window.PJA.hideTitle();
window.PJA.showTitle();

// Communication
window.PJA.sendCustomMessage('event-type', { data: 'value' });
window.PJA.requestParentAction('resize', { width: '100%', height: '800px' });

// Get title
const title = window.PJA.getTitle();
```

## PJAIframer Component (Host Side)

### Auto-Initialization
Add `data-pja-auto` attribute to iframes:
```html
<iframe 
    src="/static/example.iframe.html" 
    data-pja-auto="true"
    data-pja-log-messages="true"
    data-pja-title-selector=".custom-header h2">
</iframe>
```

### Manual Initialization
```javascript
const iframe = document.querySelector('#my-iframe');
const iframer = new PJAIframer(iframe, {
    autoUpdateTitle: true,        // Update host title automatically
    titleSelector: '.section h2', // Custom title element selector
    applyScrollbarStyles: true,   // Apply iframe scrollbar styles
    logMessages: false           // Log communication messages
});

// Event handlers
iframer.onTitleUpdate = (title) => {
    console.log('Iframe title updated:', title);
};

iframer.onScrollbarStyles = (styles) => {
    console.log('Scrollbar styles received:', styles);
};

iframer.onCustomMessage = (type, data) => {
    console.log('Custom message:', type, data);
};
```

### Sending Messages to Iframe
```javascript
iframer.sendToIframe('custom-command', { action: 'refresh' });
```

## Communication Protocol

### From Iframe to Host
```javascript
// Ready signal
{
    type: 'pja-iframe-ready',
    timestamp: 1234567890
}

// Title update
{
    type: 'pja-title-update',
    title: 'New Title'
}

// Scrollbar styles
{
    type: 'pja-scrollbar-styles',
    styles: {
        'scrollbar-width': 'thin',
        'scrollbar-color': '#4CAF50 #1a1a1a',
        '::-webkit-scrollbar': 'width: 12px;'
    }
}

// Parent action request
{
    type: 'pja-parent-action',
    action: 'resize',
    params: { width: '100%', height: '600px' }
}

// Custom message
{
    type: 'pja-custom-event-name',
    data: { custom: 'data' }
}
```

### From Host to Iframe
```javascript
{
    source: 'pja-host',
    type: 'custom-command',
    data: { action: 'refresh' }
}
```

## Scrollbar Styling

### In Iframe CSS
```css
/* Webkit browsers */
::-webkit-scrollbar {
    width: 12px;
}
::-webkit-scrollbar-track {
    background: #1a1a1a;
    border-radius: 6px;
}
::-webkit-scrollbar-thumb {
    background: #4CAF50;
    border-radius: 6px;
}

/* Firefox */
* {
    scrollbar-width: thin;
    scrollbar-color: #4CAF50 #1a1a1a;
}
```

These styles are automatically extracted and can be applied to the host iframe element.

## Integration Examples

### Basic Iframe Setup
```html
<!-- Host page -->
<div class="section">
    <div class="section-header">
        <h2>📊 Dynamic Title</h2>
    </div>
    <div class="section-content">
        <iframe 
            src="/static/my-feature.iframe.html"
            data-pja-auto="true"
            style="width: 100%; height: 600px;">
        </iframe>
    </div>
</div>

<script src="/static/pja-iframer.js"></script>
```

### Advanced Integration
```html
<!-- Host page -->
<script>
document.addEventListener('DOMContentLoaded', () => {
    const iframe = document.querySelector('#my-iframe');
    const iframer = new PJAIframer(iframe, {
        titleSelector: '.my-section h2'
    });
    
    iframer.onCustomMessage = (type, data) => {
        if (type === 'data-updated') {
            // Refresh parent data
            refreshParentData();
        }
    };
});
</script>
```

## File Structure
```
/static/
├── pja-style-sdk.js          # Iframe-side SDK
├── pja-iframer.js            # Host-side component  
├── my-feature.iframe.html    # Iframe content
├── pja-demo.iframe.html      # Demo/example
└── host-page.html            # Host page
```

## Best Practices

1. **Always use `.iframe.html` extension** for automatic SDK initialization
2. **Use semantic title elements** with PJA classes or data attributes
3. **Define custom scrollbar styles** in iframe CSS for consistent theming
4. **Handle communication errors gracefully** with try-catch blocks
5. **Use meaningful custom message types** for debugging
6. **Test iframe communication** in both development and production environments

## Debugging

Enable logging for troubleshooting:
```html
<iframe data-pja-auto="true" data-pja-log-messages="true">
```

Check browser console for:
- `PJA Style SDK: Initialized`
- `PJA Iframe ready: [url]`
- Message communication logs