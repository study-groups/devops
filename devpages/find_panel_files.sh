#!/bin/bash

# Panel Files Discovery Script
# Aggressively searches for all files related to panels and panel management

echo "🔍 Searching for panel-related files in the codebase..."
echo "=================================================="

# Base directory
BASE_DIR="/root/src/devops/devpages"
cd "$BASE_DIR"

# Output file
OUTPUT_FILE="panel_files_report.txt"
echo "Panel Files Discovery Report - $(date)" > "$OUTPUT_FILE"
echo "=========================================" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Function to search and log results
search_and_log() {
    local title="$1"
    local search_cmd="$2"
    
    echo ""
    echo "📁 $title"
    echo "-------------------"
    echo "" >> "$OUTPUT_FILE"
    echo "$title" >> "$OUTPUT_FILE"
    echo "-------------------" >> "$OUTPUT_FILE"
    
    eval "$search_cmd" | tee -a "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
}

# 1. Find files with "panel" in the name
search_and_log "FILES WITH 'PANEL' IN NAME" \
    "find . -type f -name '*panel*' -o -name '*Panel*' | grep -v node_modules | sort"

# 2. Find files with "dock" in the name
search_and_log "FILES WITH 'DOCK' IN NAME" \
    "find . -type f -name '*dock*' -o -name '*Dock*' | grep -v node_modules | sort"

# 3. Find files with "sidebar" in the name
search_and_log "FILES WITH 'SIDEBAR' IN NAME" \
    "find . -type f -name '*sidebar*' -o -name '*Sidebar*' | grep -v node_modules | sort"

# 4. Find directories related to panels
search_and_log "PANEL-RELATED DIRECTORIES" \
    "find . -type d -name '*panel*' -o -name '*Panel*' -o -name '*dock*' -o -name '*Dock*' | grep -v node_modules | sort"

# 5. Search for files containing panel-related class definitions
search_and_log "FILES WITH PANEL CLASS DEFINITIONS" \
    "grep -r -l 'class.*Panel\|export.*Panel\|function.*Panel' . --include='*.js' --include='*.ts' | grep -v node_modules | sort"

# 6. Search for files importing panel-related modules
search_and_log "FILES IMPORTING PANEL MODULES" \
    "grep -r -l 'import.*Panel\|require.*panel\|import.*panel' . --include='*.js' --include='*.ts' | grep -v node_modules | sort"

# 7. Search for files with panel management keywords
search_and_log "FILES WITH PANEL MANAGEMENT KEYWORDS" \
    "grep -r -l 'panelRegistry\|PanelRegistry\|panelManager\|PanelManager\|registerPanel\|createPanel' . --include='*.js' --include='*.ts' | grep -v node_modules | sort"

# 8. Search for files with dock-related keywords
search_and_log "FILES WITH DOCK KEYWORDS" \
    "grep -r -l 'debugDock\|DebugDock\|BaseDock\|dockManager' . --include='*.js' --include='*.ts' | grep -v node_modules | sort"

# 9. Search for files with sidebar-related keywords
search_and_log "FILES WITH SIDEBAR KEYWORDS" \
    "grep -r -l 'sidebar\|Sidebar\|sidebarPanel' . --include='*.js' --include='*.ts' | grep -v node_modules | sort"

# 10. Search for configuration files that might define panels
search_and_log "CONFIGURATION FILES WITH PANEL DEFINITIONS" \
    "grep -r -l 'panels\|panelConfig\|panelCfg' . --include='*.js' --include='*.json' --include='*.ts' | grep -v node_modules | sort"

# 11. Search for files with render/mount methods (common in panels)
search_and_log "FILES WITH RENDER/MOUNT METHODS" \
    "grep -r -l 'render()\|onMount\|renderContent\|renderPanel' . --include='*.js' --include='*.ts' | grep -v node_modules | sort"

# 12. Search for files with panel lifecycle methods
search_and_log "FILES WITH PANEL LIFECYCLE METHODS" \
    "grep -r -l 'initialize.*panel\|destroy.*panel\|togglePanel\|showPanel\|hidePanel' . --include='*.js' --include='*.ts' | grep -v node_modules | sort"

# 13. Search for CSS files related to panels
search_and_log "CSS FILES WITH PANEL STYLES" \
    "grep -r -l 'panel\|dock\|sidebar' . --include='*.css' --include='*.scss' | grep -v node_modules | sort"

# 14. Search for HTML templates with panel structures
search_and_log "HTML/TEMPLATE FILES WITH PANEL STRUCTURES" \
    "grep -r -l 'panel\|dock\|sidebar' . --include='*.html' --include='*.htm' | grep -v node_modules | sort"

# 15. Search for test files related to panels
search_and_log "TEST FILES RELATED TO PANELS" \
    "find . -type f -name '*test*' -o -name '*spec*' | xargs grep -l 'panel\|Panel\|dock\|Dock' 2>/dev/null | grep -v node_modules | sort"

# 16. Search for files with specific panel types mentioned
search_and_log "FILES MENTIONING SPECIFIC PANEL TYPES" \
    "grep -r -l 'FileTreePanel\|CLIPanel\|DebugPanel\|SettingsPanel\|CodePanel\|HtmlPanel\|ContextPanel\|PDataPanel\|CssFilesPanel\|ExternalDependenciesPanel' . --include='*.js' --include='*.ts' | grep -v node_modules | sort"

# 17. Search for files with panel event handling
search_and_log "FILES WITH PANEL EVENT HANDLING" \
    "grep -r -l 'panelEvent\|onPanelEvent\|panel.*Event\|toggleCollapse\|expandPanel\|collapsePanel' . --include='*.js' --include='*.ts' | grep -v node_modules | sort"

# 18. Search for files with workspace/layout management
search_and_log "FILES WITH WORKSPACE/LAYOUT MANAGEMENT" \
    "grep -r -l 'WorkspaceManager\|LayoutManager\|workspace\|layout.*panel' . --include='*.js' --include='*.ts' | grep -v node_modules | sort"

# 19. Find all unique file extensions in panel-related files
search_and_log "FILE EXTENSIONS IN PANEL-RELATED FILES" \
    "find . -type f -name '*panel*' -o -name '*Panel*' -o -name '*dock*' -o -name '*Dock*' | grep -v node_modules | sed 's/.*\.//' | sort | uniq -c | sort -nr"

# 20. Create a summary of all unique files found
echo ""
echo "📊 SUMMARY - ALL UNIQUE PANEL-RELATED FILES"
echo "============================================"
echo "" >> "$OUTPUT_FILE"
echo "SUMMARY - ALL UNIQUE PANEL-RELATED FILES" >> "$OUTPUT_FILE"
echo "============================================" >> "$OUTPUT_FILE"

# Combine all searches and get unique files
{
    find . -type f -name '*panel*' -o -name '*Panel*' -o -name '*dock*' -o -name '*Dock*' -o -name '*sidebar*' -o -name '*Sidebar*'
    grep -r -l 'class.*Panel\|Panel.*class\|export.*Panel\|import.*Panel\|panelRegistry\|debugDock\|sidebar' . --include='*.js' --include='*.ts' 2>/dev/null
    grep -r -l 'render()\|onMount\|renderContent\|togglePanel\|showPanel\|hidePanel' . --include='*.js' --include='*.ts' 2>/dev/null
    grep -r -l 'FileTreePanel\|CLIPanel\|DebugPanel\|SettingsPanel\|CodePanel\|HtmlPanel\|ContextPanel\|PDataPanel\|CssFilesPanel' . --include='*.js' --include='*.ts' 2>/dev/null
} | grep -v node_modules | sort | uniq | tee -a "$OUTPUT_FILE"

echo ""
echo "✅ Search complete! Results saved to: $OUTPUT_FILE"
echo "📈 Total unique panel-related files found: $(cat "$OUTPUT_FILE" | grep -E '^\./.*\.(js|ts|css|html|json)$' | wc -l)"

# Make the script executable
chmod +x "$0"
