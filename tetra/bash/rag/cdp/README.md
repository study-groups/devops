# CDP Module

**Version:** 1.0
**Status:** Active
**TCS Version:** 3.0
**Parent Module:** RAG

## Overview

The CDP (Chrome DevTools Protocol) module enables agent-driven browser automation for the RAG query flow system. It provides programmatic control over Chrome/Chromium browsers through the DevTools Protocol, allowing agents to:

- Navigate to URLs
- Extract page content
- Take screenshots
- Execute JavaScript
- Interact with page elements

## Module Structure

```
bash/rag/cdp/
├── cdp.sh              # Core CDP functionality
├── cdp_paths.sh        # TCS 3.0 path management
├── actions.sh          # TUI integration
├── includes.sh         # Module entry point
├── core/               # Core components
├── helpers/            # Helper functions
└── README.md           # This file
```

## TCS 3.0 Compliance

### Database Pattern

All CDP outputs follow the timestamp-based primary key pattern:

```
$TETRA_DIR/cdp/
├── db/                           # Primary key database
│   ├── {timestamp}.cdp.screenshot.png
│   ├── {timestamp}.cdp.trace.json
│   ├── {timestamp}.cdp.action.json
│   ├── {timestamp}.cdp.page.html
│   └── {timestamp}.cdp.meta.json
├── config/                       # Module configuration
│   └── chrome.pid                # Chrome process ID
├── logs/                         # Module logs
│   └── chrome.log                # Chrome output
└── cache/                        # Temporary artifacts
```

### Type Contracts

All CDP functions declare type contracts using the `::` operator:

```bash
cdp.connect :: (port:int) → Session[websocket]
  where Effect[state]

cdp.navigate :: (url:string) → Event[loadEventFired]
  where Effect[browser, log]

cdp.screenshot :: () → @cdp:timestamp.screenshot.png
  where Effect[cache, db]

cdp.execute :: (js:string) → Result[json]
  where Effect[browser, log]

cdp.extract :: (selector:string) → Text[stdout]
  where Effect[browser]
```

## Prerequisites

### Required

- **Chrome/Chromium**: Installed on system
- **bash**: 5.2 or higher
- **jq**: JSON processor
- **curl**: HTTP client

### Optional

- **websocat**: WebSocket client (required for direct CDP commands)
  ```bash
  brew install websocat
  ```

## Installation

The CDP module is part of the RAG module. To use it:

```bash
# Source tetra
source ~/tetra/tetra.sh

# Load RAG module (includes CDP)
tmod load rag

# Initialize CDP
cdp_init
```

## Usage

### Basic Workflow

```bash
# 1. Initialize CDP directories
cdp_init

# 2. Launch Chrome with remote debugging
cdp_launch_chrome 9222

# 3. Connect to CDP
cdp_connect 9222

# 4. Navigate to URL
cdp_navigate "https://example.com"

# 5. Take screenshot
cdp_screenshot

# 6. Extract content
cdp_extract "h1"

# 7. Get full page HTML
cdp_get_html

# 8. Cleanup
cdp_kill_chrome
```

### RAG Flow Integration

The CDP module integrates with RAG flows to enable agent-driven browser automation:

```bash
# Create a RAG flow
rag flow start "Extract data from example.com"

# Use CDP actions in the flow
cdp_navigate "https://example.com"
screenshot_path=$(cdp_screenshot)

# Add screenshot as evidence
select_files_as_evidence "" "$screenshot_path"

# Extract content and add to context
cdp_extract "article" > /tmp/content.txt
select_files_as_evidence "" /tmp/content.txt

# Assemble context with browser artifacts
rag assemble
```

### Cross-Module Correlation

CDP preserves timestamps from other modules for correlation:

```bash
# QA generates answer
timestamp=$(date +%s)
qa.query "question" > "$QA_DIR/db/$timestamp.answer"

# CDP processes with same timestamp
cdp_screenshot "$timestamp"
# → Creates: $CDP_DIR/db/$timestamp.cdp.screenshot.png

# Find all related artifacts
find $TETRA_DIR -name "$timestamp.*"
# Output:
# ~/tetra/qa/db/1760229927.answer
# ~/tetra/cdp/db/1760229927.cdp.screenshot.png
```

## API Reference

### Connection Management

#### `cdp_init()`
Initialize CDP directories.

```bash
cdp_init
```

#### `cdp_launch_chrome([port])`
Launch Chrome with remote debugging.

```bash
cdp_launch_chrome 9222
```

**Parameters:**
- `port` (optional): CDP port (default: 9222)

#### `cdp_connect([port])`
Connect to running Chrome instance.

```bash
cdp_connect 9222
```

**Parameters:**
- `port` (optional): CDP port (default: 9222)

#### `cdp_disconnect()`
Disconnect from CDP session.

```bash
cdp_disconnect
```

#### `cdp_kill_chrome()`
Kill Chrome process launched by CDP.

```bash
cdp_kill_chrome
```

### Navigation

#### `cdp_navigate(url)`
Navigate to URL.

```bash
cdp_navigate "https://example.com"
```

**Parameters:**
- `url`: Target URL (required)

**Returns:** CDP response JSON

**Effects:**
- Creates `$CDP_DIR/db/{timestamp}.cdp.action.json`

### Data Extraction

#### `cdp_screenshot([timestamp])`
Capture page screenshot.

```bash
screenshot_path=$(cdp_screenshot)
# Or with specific timestamp:
cdp_screenshot 1760229927
```

**Parameters:**
- `timestamp` (optional): Explicit timestamp for correlation

**Returns:** Path to screenshot PNG file

**Effects:**
- Creates `$CDP_DIR/db/{timestamp}.cdp.screenshot.png`

#### `cdp_get_html([timestamp])`
Get full page HTML.

```bash
html_path=$(cdp_get_html)
```

**Parameters:**
- `timestamp` (optional): Explicit timestamp for correlation

**Returns:** Path to HTML file

**Effects:**
- Creates `$CDP_DIR/db/{timestamp}.cdp.page.html`

#### `cdp_extract(selector)`
Extract text by CSS selector.

```bash
cdp_extract "h1"
cdp_extract ".article-content"
```

**Parameters:**
- `selector`: CSS selector (required)

**Returns:** Extracted text (stdout)

### Interaction

#### `cdp_execute(js_code)`
Execute JavaScript in page context.

```bash
cdp_execute "document.title"
cdp_execute "document.querySelectorAll('a').length"
```

**Parameters:**
- `js_code`: JavaScript code (required)

**Returns:** Execution result (stdout)

#### `cdp_click(selector)`
Click element by CSS selector.

```bash
cdp_click "button#submit"
```

**Parameters:**
- `selector`: CSS selector (required)

#### `cdp_type(selector, text)`
Type text into input element.

```bash
cdp_type "input#search" "query text"
```

**Parameters:**
- `selector`: CSS selector (required)
- `text`: Text to type (required)

## TUI Actions

When used in demo 014, CDP registers the following actions:

| Action | Context | Mode | Description |
|--------|---------|------|-------------|
| `launch:chrome` | Local | Execute | Launch Chrome with CDP |
| `connect:cdp` | Local | Execute | Connect to CDP |
| `navigate:url` | Local | Execute | Navigate to URL |
| `screenshot:page` | Local | Inspect | Take screenshot |
| `get:html` | Local | Inspect | Get page HTML |
| `extract:text` | Local | Inspect | Extract text by selector |
| `execute:javascript` | Local | Execute | Execute JavaScript |
| `click:element` | Local | Execute | Click element |
| `type:text` | Local | Execute | Type into element |
| `disconnect:cdp` | Local | Execute | Disconnect from CDP |
| `kill:chrome` | Local | Execute | Kill Chrome process |
| `init:cdp` | Local | Execute | Initialize CDP |

## Examples

### Example 1: Extract Article Content

```bash
# Launch and connect
cdp_init
cdp_launch_chrome
cdp_connect

# Navigate and extract
cdp_navigate "https://example.com/article"
cdp_extract "article .content"

# Cleanup
cdp_kill_chrome
```

### Example 2: Take Screenshots for RAG Flow

```bash
# Create flow
rag flow start "Document UI changes"

# Navigate and capture
cdp_connect
cdp_navigate "https://app.example.com"
screenshot_before=$(cdp_screenshot)

# Make changes (manual or via CDP)
cdp_click "button#toggle-theme"
sleep 1
screenshot_after=$(cdp_screenshot)

# Add as evidence
select_files_as_evidence "" "$screenshot_before" "$screenshot_after"

# Assemble context
rag assemble
```

### Example 3: Automated Form Filling

```bash
cdp_connect
cdp_navigate "https://example.com/form"

# Fill form
cdp_type "input#name" "John Doe"
cdp_type "input#email" "john@example.com"
cdp_click "button[type=submit]"

# Wait for response
sleep 2

# Capture result
cdp_screenshot
cdp_get_html
```

## Troubleshooting

### Chrome Not Found

If `cdp_get_chrome_binary` fails:

1. Install Chrome/Chromium:
   ```bash
   # macOS
   brew install --cask google-chrome
   # or
   brew install --cask chromium
   ```

2. Add to PATH or update `cdp_get_chrome_binary()` in `cdp.sh`

### websocat Not Found

CDP requires `websocat` for WebSocket communication:

```bash
brew install websocat
```

### Connection Failed

If `cdp_connect` fails:

1. Check if Chrome is running:
   ```bash
   curl http://localhost:9222/json/version
   ```

2. Verify port is not in use:
   ```bash
   lsof -i :9222
   ```

3. Launch Chrome manually:
   ```bash
   cdp_launch_chrome 9222
   ```

## Limitations

- **Headless Mode**: Currently runs Chrome in headless mode only
- **Single Session**: Only one CDP connection supported at a time
- **macOS Focused**: Paths optimized for macOS (Linux paths can be added)
- **No Extensions**: Chrome launched without extensions

## Future Enhancements

1. **Multi-Session Support**: Multiple browser tabs/windows
2. **Network Interception**: Modify requests/responses
3. **Performance Tracing**: Capture performance metrics
4. **Mobile Emulation**: Test mobile viewports
5. **CDP Event Streaming**: Real-time event monitoring
6. **Recording & Replay**: Record browser sessions

## References

- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)
- [Tetra Module Convention](../../../docs/Tetra_Module_Convention.md)
- [TCS 3.0](../../../docs/Tetra_Core_Specification.md)
- [RAG Module](../README.md)

## Version History

- **1.0** (2025-10-16) - Initial implementation
  - TCS 3.0 compliant
  - Basic CDP operations
  - RAG flow integration
  - TUI action registration
