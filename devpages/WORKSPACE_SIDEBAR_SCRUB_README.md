# Workspace Sidebar System Scrub

This directory contains a comprehensive set of bash scripts designed to scrub the codebase for everything related to WorkspaceManager's sidebar management system, including Docks, Panels, Settings, Controls, Logs, and their Redux state tracking.

## 🎯 Purpose

The WorkspaceManager needs to manage a sidebar that contains Docks (Settings, Controls, Logs). Each dock can contain multiple panels, but when a dock has only a single panel, it may assume ownership and take over the panel's name to preserve UI real estate. Both docks and panels must be able to fly out of their parent containers, and all of this must be tracked by Redux.

## 🚀 Quick Start

### Main Launcher
```bash
./workspace-sidebar-scrub.sh
```

This interactive script provides options to run specific searches or a comprehensive analysis.

### Run All Searches
```bash
./scripts/run-all-searches.sh
```

This runs all specialized search scripts and creates a consolidated report with timestamped results directory.

## 📋 Available Search Scripts

### 1. Comprehensive System Search
**File:** `scripts/search-workspace-sidebar-system.sh`
**Purpose:** Overall system architecture analysis
**Searches for:**
- WorkspaceManager core functionality
- Zone management (sidebar, editor, preview)
- Dock definitions and management
- Panel system overview
- Keyboard shortcuts
- CSS styling

### 2. Redux State Tracking
**File:** `scripts/search-redux-state-tracking.sh`
**Purpose:** Deep dive into Redux state management
**Searches for:**
- Panel and dock slices
- State structure analysis
- Redux actions and reducers
- Selectors and middleware
- State persistence
- Store integration

### 3. Panel Components Analysis
**File:** `scripts/search-panel-components.sh`
**Purpose:** Individual panel implementations
**Searches for:**
- Panel registry and base classes
- Specific panels (design-tokens, theme-selector, css-settings, etc.)
- Panel rendering and lifecycle
- Panel state management
- Panel drag and drop

### 4. Dock System Analysis
**File:** `scripts/search-dock-system.sh`
**Purpose:** Dock system and fly-out capabilities
**Searches for:**
- Dock class definitions
- Settings/Controls/Logs dock implementations
- Single panel ownership mechanisms
- Fly-out and windowing system
- Dock actions and events
- Dock configuration

### 5. Sidebar Management
**File:** `scripts/search-sidebar-management.sh`
**Purpose:** Sidebar zone management
**Searches for:**
- Sidebar zone definitions
- WorkspaceManager sidebar control
- Sidebar dock placement
- Sidebar scrolling and layout
- Left zone system
- Sidebar events and styling

## 📊 Output Structure

When you run the searches, they create detailed markdown reports:

```
search-results-YYYYMMDD-HHMMSS/
├── MASTER_SEARCH_REPORT.md           # Consolidated overview
├── workspace-sidebar-system-search-results.md
├── redux-state-tracking-results.md
├── panel-components-search-results.md
├── dock-system-search-results.md
├── sidebar-management-search-results.md
├── analyze-results.sh                # Helper analysis script
└── *-output.txt                      # Raw script outputs
```

## 🔍 Key Search Patterns

The scripts search for various patterns related to:

### Docks
- `dock|Dock|dockId|createDock|registerDock`
- `settings-dock|controls-dock|logs-dock`
- `flyOut|detach|floating|windowed`
- `takeover|ownership|assume.*name`

### Panels
- `panel|Panel|panelId|createPanel|registerPanel`
- `design-tokens|theme-selector|css-settings|preview-settings`
- `sidebarPanels|panel.*sidebar`
- `panel.*flyOut|detach.*panel`

### WorkspaceManager
- `WorkspaceManager|workspaceManager`
- `semanticZones|workspace-sidebar`
- `sidebar.*zone|zone.*sidebar`

### Redux State
- `state.*docks|docks.*state`
- `state.*panels|panels.*state`
- `panelSlice|dock.*slice`
- `dispatch.*panel|dispatch.*dock`

## 🛠️ Requirements

- **ripgrep (`rg`)**: For fast text searching
- **bash**: For script execution
- **find/grep**: Standard Unix tools

### Installing ripgrep
```bash
# Ubuntu/Debian
sudo apt-get install ripgrep

# macOS
brew install ripgrep

# Or download from: https://github.com/BurntSushi/ripgrep#installation
```

## 📖 Usage Examples

### Quick File Listing
```bash
# Get quick overview of relevant files
./workspace-sidebar-scrub.sh
# Choose option 8
```

### Search for Specific Patterns
```bash
# Custom search
./workspace-sidebar-scrub.sh
# Choose option 7, enter your pattern
```

### Analyze Existing Results
```bash
cd search-results-*/
./analyze-results.sh
cat MASTER_SEARCH_REPORT.md
```

### Search Specific Components
```bash
# Just dock system
./scripts/search-dock-system.sh

# Just Redux state
./scripts/search-redux-state-tracking.sh
```

## 🎯 Key Areas to Focus On

Based on your requirements, pay special attention to:

### 1. Settings Dock Implementation
- How the Settings dock manages multiple panels
- Single panel ownership mechanisms
- Panel registration: `design-tokens`, `theme-selector`, `css-settings`, `preview-settings`, `icons-panel`, `plugins-panel`

### 2. Dock Name Takeover
- Logic for when docks assume panel names
- Real estate preservation mechanisms
- UI state management for name changes

### 3. Fly-out Capabilities
- Panel fly-out from docks
- Dock fly-out from sidebar
- Parent-child relationship tracking
- Window management for detached components

### 4. Redux State Tracking
- Dock state structure in store
- Panel state management
- Fly-out state tracking
- State persistence and restoration

### 5. WorkspaceManager Integration
- How WorkspaceManager controls the sidebar
- Zone management and dock placement
- Rendering and re-rendering logic
- Event handling and subscriptions

## 🔧 Customization

You can modify the search scripts to:

1. **Add new search patterns** by editing the script files
2. **Focus on specific directories** by modifying the `focus_dirs` parameters
3. **Change output format** by modifying the logging functions
4. **Add new search categories** by creating additional sections

## 📝 Analysis Workflow

1. **Start with comprehensive search:**
   ```bash
   ./scripts/run-all-searches.sh
   ```

2. **Review master report:**
   ```bash
   cd search-results-*/
   cat MASTER_SEARCH_REPORT.md
   ```

3. **Deep dive into specific areas:**
   - Check dock system implementation
   - Review Redux state management
   - Analyze panel components
   - Examine sidebar management

4. **Identify gaps and issues:**
   - Missing implementations
   - Inconsistent state management
   - Broken fly-out mechanisms
   - Redux action/reducer mismatches

5. **Plan refactoring:**
   - Based on search results
   - Focus on critical path: Settings Dock → Single Panel → Fly-out
   - Ensure Redux tracking for all state changes

## 🚨 Important Notes

- The scripts use case-insensitive searches (`-i` flag)
- Results include context lines (`-C` flag) for better understanding
- Large files are truncated in output to prevent overwhelming results
- All scripts are designed to be run from the project root directory
- Results are timestamped to avoid conflicts

## 🤝 Contributing

To add new search capabilities:

1. Create a new script in the `scripts/` directory
2. Follow the existing pattern for output formatting
3. Add the script to `run-all-searches.sh`
4. Update this README with the new functionality

---

**Generated for WorkspaceManager sidebar system analysis**
*Focus: Docks, Panels, Settings, Controls, Logs, Redux state tracking, fly-out capabilities*