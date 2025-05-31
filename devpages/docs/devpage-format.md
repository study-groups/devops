# DevPage File Format Specification

The `.devpage` file format is a YAML-based configuration that defines semantic groups of files that work together to create a DevPages application or component.

## Purpose

- **Semantic Grouping**: Define which files work together as a cohesive unit
- **Dependency Mapping**: Specify how files depend on each other
- **Component Definition**: Describe the purpose and interface of the group
- **Build Instructions**: Define how the group should be processed or built

## File Structure

```yaml
# Basic metadata
name: "component-name"
version: "1.0.0"
description: "Brief description of what this group does"
type: "component" | "app" | "game" | "sdk" | "demo"

# File grouping
files:
  entry: "main.html"  # Primary entry point
  sources:
    - "script.js"
    - "styles.css"
    - "config.json"
  dependencies:
    - "../common/utils.js"
    - "./lib/helper.js"
  
# Semantic roles
roles:
  client: ["client.js", "client.html"]
  host: ["host.js"]
  server: ["server.js"]
  common: ["utils.js", "constants.js"]
  config: ["config.json", "settings.yaml"]

# Interface definition
interface:
  exports:
    - name: "ComponentName"
      type: "class"
      file: "script.js"
    - name: "initComponent"
      type: "function"
      file: "script.js"
  
  events:
    emits:
      - "component:ready"
      - "component:error"
    listens:
      - "app:init"
      - "app:destroy"
  
  api:
    endpoints: []
    methods:
      - name: "getData"
        returns: "Promise<Object>"

# Build configuration
build:
  target: "browser" | "node" | "universal"
  minify: true
  bundle: false
  outputDir: "dist"

# Development metadata
dev:
  author: "Developer Name"
  created: "2024-01-01"
  updated: "2024-01-15"
  tags: ["ui", "component", "interactive"]
  
# Analysis hints
analysis:
  entryPoints: ["script.js"]
  ignoreFiles: ["*.test.js", "*.spec.js"]
  parseOptions:
    javascript:
      moduleType: "es6"
    css:
      preprocessor: "none"
```

## File Types and Roles

### Standard Roles

- **client**: Files that run in the browser/client environment
- **host**: Files that manage iframe/container communication
- **server**: Files that run on the server side
- **common**: Shared utilities and constants
- **config**: Configuration and settings files
- **assets**: Static resources (images, fonts, etc.)
- **tests**: Test files and specifications

### File Type Detection

The system automatically detects file types and suggests roles based on:

- File extensions (`.js`, `.html`, `.css`, etc.)
- Content analysis (imports, exports, DOM usage)
- Naming conventions (`client.js`, `server.js`, `config.json`)
- Directory structure (`/client/`, `/server/`, `/common/`)

## Integration with DevPages

### Project Structure

```
project/
├── devpages.json          # Main project configuration
├── components/
│   ├── ui-component/
│   │   ├── component.devpage  # Component definition
│   │   ├── component.js
│   │   ├── component.css
│   │   └── component.html
│   └── game-engine/
│       ├── engine.devpage
│       ├── engine.js
│       └── physics.js
└── app/
    ├── app.devpage        # Main app definition
    ├── index.html
    ├── client/
    │   └── client.js
    └── host/
        └── host.js
```

### Code Analysis Integration

The `.devpage` files provide hints to the CodeManager for:

- **Entry Point Detection**: Where to start dependency analysis
- **Role-based Parsing**: Different parsing strategies for different file roles
- **Interface Extraction**: What exports and events to look for
- **Dependency Resolution**: How files relate to each other

### Event Bus Integration

Components defined in `.devpage` files can specify:

- **Event Contracts**: What events they emit and listen for
- **Namespacing**: Event namespace prefixes
- **Communication Patterns**: How they interact with other components

## Example Use Cases

### 1. UI Component

```yaml
name: "file-browser"
type: "component"
description: "Interactive file browser with tree view"

files:
  entry: "file-browser.html"
  sources:
    - "file-browser.js"
    - "file-browser.css"

roles:
  client: ["file-browser.js", "file-browser.html", "file-browser.css"]

interface:
  exports:
    - name: "FileBrowser"
      type: "class"
      file: "file-browser.js"
  
  events:
    emits: ["file:selected", "directory:changed"]
    listens: ["app:refresh", "files:updated"]
```

### 2. Game SDK

```yaml
name: "game-sdk"
type: "sdk"
description: "Game development SDK with host/client architecture"

files:
  entry: "container.md"
  sources:
    - "gameSDK.js"
    - "host.js"
    - "client.html"

roles:
  host: ["host.js"]
  client: ["client.html", "gameSDK.js"]
  common: ["gameSDK.js"]

interface:
  events:
    emits: ["game:ready", "score:update"]
    listens: ["host:pause", "host:resume"]
  
  api:
    methods:
      - name: "initGame"
        file: "gameSDK.js"
      - name: "getScore"
        returns: "number"
```

### 3. Full Application

```yaml
name: "devpages-editor"
type: "app"
description: "Code editor with live preview"

files:
  entry: "index.html"
  sources:
    - "client/**/*.js"
    - "client/**/*.css"
    - "host/**/*.js"

roles:
  client: ["client/**/*"]
  host: ["host/**/*"]
  config: ["devpages.json"]

build:
  target: "browser"
  bundle: true
  outputDir: "dist"
```

## Benefits

1. **Semantic Understanding**: Clear definition of file relationships and purposes
2. **Automated Analysis**: Better code analysis with role-based hints
3. **Component Reusability**: Well-defined interfaces for component composition
4. **Development Workflow**: Streamlined development with clear file organization
5. **Documentation**: Self-documenting code structure and interfaces 