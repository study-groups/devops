# DevPages Code Editor Architecture

## Overview

We've built a sophisticated code intelligence system within DevPages that provides:

1. **File List Component** - Card-based UI with strong file type awareness
2. **CodeManager** - AST parsing and dependency analysis using tree-sitter patterns
3. **DevPages Configuration System** - Project structure definition via `devpages.json`
4. **DevPage File Format** - Semantic grouping of related files via `.devpage` files
5. **Integrated Sidebar** - Left sidebar that appears only in Code mode

## Architecture Components

### 1. File List Component (`client/code/file-list-component.js`)

**Purpose**: Provides a modern, card-based file browser with strong file type awareness.

**Key Features**:
- Card-like UI with file type categorization
- Color-coded file types (JavaScript, HTML, CSS, Bash, etc.)
- Action buttons for edit, analyze, and info
- Real-time analysis status indicators
- Responsive design with hover effects

**File Type Categories**:
- **Script**: JavaScript, ES modules (yellow theme)
- **Markup**: HTML files (red theme)
- **Style**: CSS files (blue theme)
- **Document**: Markdown files (dark blue theme)
- **Config**: JSON, DevPages config (gray theme)
- **DevPages**: `.devpage` files (purple theme)

### 2. CodeManager (`client/code/code-manager.js`)

**Purpose**: Advanced code analysis and AST management using tree-sitter patterns.

**Key Features**:
- **Multi-language Parsing**: JavaScript, HTML, CSS, Bash
- **Function Extraction**: Identifies functions, methods, and exports
- **Dependency Analysis**: Tracks imports, requires, and event bus usage
- **Project Structure Analysis**: Understands DevPages project layout
- **Event-driven Architecture**: Integrates with the event bus system

**Analysis Capabilities**:
```javascript
// Function extraction
{
  name: "functionName",
  type: "function_declaration",
  startLine: 10,
  endLine: 25,
  parameters: ["param1", "param2"],
  isAsync: false,
  isExported: true,
  scope: "global"
}

// Dependency tracking
{
  imports: [{ source: "./utils.js", specifiers: ["helper"], line: 1 }],
  exports: [{ name: "MyClass", type: "class", line: 50 }],
  requires: [{ source: "fs", line: 3 }],
  eventBusUsage: [{ method: "eventBus.emit", event: "ready", line: 15 }]
}
```

### 3. DevPages Configuration (`devpages.json`)

**Purpose**: Main project configuration following a comprehensive schema.

**Key Sections**:
- **Structure**: Defines client/host/server/common directories
- **Dependencies**: CDN and API dependencies
- **Event Bus**: Event definitions and namespacing
- **Communication**: Host-to-client and client-to-host message types
- **Code Analysis**: Parser configuration and feature flags

**Example Structure**:
```json
{
  "name": "pja-games-sdk-example",
  "type": "sdk",
  "structure": {
    "entry": "container.md",
    "client": { "directory": ".", "entry": "client.html" },
    "host": { "directory": "host", "entry": "host.js" }
  },
  "eventBus": {
    "namespace": "wb001",
    "events": [
      { "name": "ping-bus", "description": "Ping the local event bus" }
    ]
  }
}
```

### 4. DevPage File Format (`.devpage`)

**Purpose**: Semantic grouping of files that work together as a cohesive unit.

**Key Features**:
- **File Grouping**: Defines which files belong together
- **Role Assignment**: Semantic roles (client, host, server, common)
- **Interface Definition**: Exports, events, and API methods
- **Communication Patterns**: Event bus and iframe communication
- **Analysis Hints**: Guides the CodeManager for better parsing

**Example DevPage**:
```yaml
name: "game-sdk"
type: "sdk"
files:
  entry: "container.md"
  sources: ["gameSDK.js", "host.js", "client.html"]
roles:
  host: ["host.js"]
  client: ["client.html", "gameSDK.js"]
interface:
  events:
    emits: ["game:ready", "score:update"]
    listens: ["host:pause", "host:resume"]
```

### 5. Enhanced Sidebar Integration

**Purpose**: Seamless integration with the existing DevPages view system.

**Key Features**:
- **View Mode Awareness**: Only appears in Code mode
- **Component Integration**: Uses FileListComponent and CodeManager
- **Real-time Analysis**: Shows function counts and dependency info
- **Event Bus Integration**: Listens for file operations and analysis results

## Integration Points

### Event Bus System

The code editor integrates with DevPages' event bus:

```javascript
// File operations
eventBus.emit('file:open', { filename, type: 'edit' });
eventBus.emit('file:analyze', { filename, language });

// Analysis results
eventBus.emit('code:analysis-complete', {
  filename, ast, functions, dependencies
});

// Navigation
eventBus.emit('navigate:pathname', { pathname, isDirectory });
```

### View Mode System

Integrates with the existing Code/Preview/Split view system:

```javascript
// Listens for view mode changes
document.addEventListener('click', (e) => {
  if (e.target.dataset.action === 'setView') {
    const viewMode = e.target.dataset.viewMode;
    // Show/hide sidebar based on view mode
  }
});
```

### File API Integration

Uses the existing DevPages file API:

```javascript
// List files
fetch('/api/files/list?pathname=' + encodeURIComponent(path))

// Read file content
fetch('/api/files/read?pathname=' + encodeURIComponent(filename))
```

## Development Workflow

### 1. Project Setup

1. Create `devpages.json` with project structure
2. Define `.devpage` files for component groupings
3. Organize files according to client/host/server pattern

### 2. Code Analysis

1. Open DevPages in Code mode
2. Sidebar automatically loads file list
3. Click "Analyze" button on files for AST parsing
4. View function lists and dependency graphs
5. Navigate between related files

### 3. Component Development

1. Define component interface in `.devpage` file
2. Implement files according to defined roles
3. Use event bus for component communication
4. Test integration through DevPages preview

## Future Enhancements

### Tree-sitter Integration

Replace mock parsers with real tree-sitter WASM modules:

```javascript
// Load tree-sitter parsers
const Parser = require('web-tree-sitter');
await Parser.init();
const JavaScript = await Parser.Language.load('tree-sitter-javascript.wasm');
```

### Dependency Graph Visualization

Create visual dependency graphs:

```javascript
// Generate graph data
const graph = codeManager.getDependencyGraph();
// Render with D3.js or similar
renderDependencyGraph(graph);
```

### Function List Panel

Add a dedicated function list view:

```javascript
// Get all functions across project
const allFunctions = codeManager.getAllFunctions();
// Group by file and display in sidebar
renderFunctionList(allFunctions);
```

### Real-time Analysis

Implement file watching for automatic re-analysis:

```javascript
// Watch for file changes
eventBus.on('file:changed', async (filename) => {
  await codeManager.parseFile(filename);
});
```

## Benefits

1. **Code Intelligence**: Deep understanding of project structure and dependencies
2. **Visual Organization**: Clear file categorization and relationship visualization
3. **Development Efficiency**: Quick navigation and analysis of code structure
4. **Component Reusability**: Well-defined interfaces and semantic groupings
5. **Event-driven Architecture**: Seamless integration with DevPages ecosystem

## Technical Considerations

### Performance

- **Lazy Loading**: Parse files only when needed
- **Caching**: Store ASTs and analysis results
- **Web Workers**: Move heavy parsing to background threads

### Scalability

- **Incremental Analysis**: Update only changed files
- **Modular Parsers**: Load language parsers on demand
- **Efficient Storage**: Compress and serialize analysis data

### Extensibility

- **Plugin Architecture**: Allow custom file type handlers
- **Custom Parsers**: Support for additional languages
- **Analysis Plugins**: Extensible analysis capabilities

This architecture provides a solid foundation for a sophisticated code editor within DevPages, optimized for the specific patterns and requirements of DevPages applications. 