#!/bin/bash

# =================================================================
# WORKSPACE SIDEBAR SYSTEM COMPREHENSIVE SEARCH
# =================================================================
# This script searches for everything related to WorkspaceManager's
# sidebar management, Docks, Panels, Settings, Controls, and Logs
# =================================================================

echo "🔍 WORKSPACE SIDEBAR SYSTEM COMPREHENSIVE SEARCH"
echo "================================================="
echo "Searching for: WorkspaceManager, Docks, Panels, Settings, Controls, Logs"
echo "Tracking: Redux state, fly-out capabilities, zone management"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Output file
OUTPUT_FILE="workspace-sidebar-search-results.md"
echo "# Workspace Sidebar System Search Results" > $OUTPUT_FILE
echo "Generated on: $(date)" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

# Function to search and log results
search_and_log() {
    local category="$1"
    local description="$2"
    local pattern="$3"
    local file_types="$4"
    
    echo -e "${CYAN}📂 Searching: $category${NC}"
    echo "   $description"
    echo ""
    
    echo "## $category" >> $OUTPUT_FILE
    echo "$description" >> $OUTPUT_FILE
    echo "" >> $OUTPUT_FILE
    
    # Search with ripgrep, case insensitive, show line numbers
    if [ -n "$file_types" ]; then
        rg -i -n --type "$file_types" "$pattern" . >> temp_results.txt 2>/dev/null
    else
        rg -i -n "$pattern" . >> temp_results.txt 2>/dev/null
    fi
    
    if [ -s temp_results.txt ]; then
        echo -e "${GREEN}✅ Found matches:${NC}"
        cat temp_results.txt | head -20  # Show first 20 matches
        echo ""
        
        echo '```' >> $OUTPUT_FILE
        cat temp_results.txt >> $OUTPUT_FILE
        echo '```' >> $OUTPUT_FILE
        echo "" >> $OUTPUT_FILE
        
        # Count matches
        local count=$(wc -l < temp_results.txt)
        echo -e "${YELLOW}   Total matches: $count${NC}"
        echo ""
    else
        echo -e "${RED}❌ No matches found${NC}"
        echo ""
        echo "No matches found." >> $OUTPUT_FILE
        echo "" >> $OUTPUT_FILE
    fi
    
    rm -f temp_results.txt
}

# =================================================================
# 1. WORKSPACE MANAGER CORE
# =================================================================

search_and_log "WorkspaceManager Core" \
    "Main WorkspaceManager class and its methods" \
    "WorkspaceManager|workspaceManager" \
    "js"

search_and_log "Workspace Zone Management" \
    "Zone definitions, semantic zones, zone switching" \
    "semanticZones|workspace-sidebar|workspace-editor|workspace-preview" \
    "js"

# =================================================================
# 2. DOCK SYSTEM
# =================================================================

search_and_log "Dock Definitions" \
    "Dock creation, management, and configuration" \
    "dock|Dock|dockId|createDock|registerDock" \
    "js"

search_and_log "Settings Dock" \
    "Settings dock specifically" \
    "settings-dock|settingsDock|Settings.*Dock" \
    "js"

search_and_log "Controls Dock" \
    "Controls dock and control panels" \
    "controls-dock|controlsDock|Controls.*Dock|control.*panel" \
    "js"

search_and_log "Logs Dock" \
    "Logs dock and logging panels" \
    "logs-dock|logsDock|Logs.*Dock|log.*panel|LogPanel" \
    "js"

# =================================================================
# 3. PANEL SYSTEM
# =================================================================

search_and_log "Panel Registry" \
    "Panel registration and definitions" \
    "panelRegistry|registerPanel|panelDefinitions" \
    "js"

search_and_log "Panel Management Actions" \
    "Redux actions for panel management" \
    "panels/registerPanel|panels/createPanel|panels/movePanel|panels/togglePanel" \
    "js"

search_and_log "Panel State Management" \
    "Panel state in Redux store" \
    "panelSlice|panelState|sidebarPanels" \
    "js"

search_and_log "Panel Types - Settings" \
    "Settings-related panels" \
    "design-tokens|theme-selector|css-settings|preview-settings|icons-panel|plugins-panel|SettingsPanel" \
    "js"

# =================================================================
# 4. FLY-OUT SYSTEM
# =================================================================

search_and_log "Fly-out Functionality" \
    "Panel and dock fly-out capabilities" \
    "flyOut|fly.*out|detach|floating|windowed" \
    "js"

search_and_log "Panel Ownership Transfer" \
    "Single panel docks taking over names" \
    "takeover|ownership|assume.*name|preserve.*estate" \
    "js"

# =================================================================
# 5. REDUX STATE TRACKING
# =================================================================

search_and_log "Redux Dock State" \
    "Redux state for docks" \
    "state\..*docks|docks.*state|dock.*visible|dock.*panels" \
    "js"

search_and_log "Redux Panel State" \
    "Redux state for panels" \
    "state\..*panels|panels.*state|panel.*visible|panel.*zone" \
    "js"

search_and_log "Redux Actions - Dock Operations" \
    "Redux actions for dock operations" \
    "type:.*dock|dock.*action|CREATE_DOCK|TOGGLE_DOCK|MOVE_DOCK" \
    "js"

search_and_log "Redux Actions - Panel Operations" \
    "Redux actions for panel operations" \
    "type:.*panel|panel.*action|CREATE_PANEL|TOGGLE_PANEL|MOVE_PANEL" \
    "js"

# =================================================================
# 6. SIDEBAR SPECIFIC
# =================================================================

search_and_log "Sidebar Management" \
    "Sidebar-specific functionality" \
    "sidebar|Sidebar|left.*zone|workspace-sidebar" \
    "js"

search_and_log "Sidebar Panel Management" \
    "Sidebar panel specific code" \
    "sidebarPanels|sidebar.*panel|panel.*sidebar" \
    "js"

# =================================================================
# 7. CSS AND STYLING
# =================================================================

search_and_log "Workspace Layout CSS" \
    "CSS for workspace layout and zones" \
    "workspace-sidebar|workspace-editor|workspace-preview|\.dock|\.panel" \
    "css"

search_and_log "Panel Styling" \
    "CSS for panel styling" \
    "\.panel|\.dock|sidebar|flyout|floating" \
    "css"

# =================================================================
# 8. KEYBOARD SHORTCUTS
# =================================================================

search_and_log "Keyboard Shortcuts - Docks" \
    "Keyboard shortcuts for dock operations" \
    "Ctrl.*Shift.*S|toggle.*dock|dock.*shortcut" \
    "js"

search_and_log "Keyboard Shortcuts - Panels" \
    "Keyboard shortcuts for panel operations" \
    "panel.*shortcut|toggle.*panel" \
    "js"

# =================================================================
# 9. SPECIFIC COMPONENTS
# =================================================================

search_and_log "Design Tokens Panel" \
    "Design tokens panel implementation" \
    "design-tokens|designTokens|DesignTokens" \
    "js"

search_and_log "Theme Selector Panel" \
    "Theme selector panel implementation" \
    "theme-selector|themeSelector|ThemeSelector" \
    "js"

search_and_log "CSS Settings Panel" \
    "CSS settings panel implementation" \
    "css-settings|cssSettings|CssSettings" \
    "js"

search_and_log "Preview Settings Panel" \
    "Preview settings panel implementation" \
    "preview-settings|previewSettings|PreviewSettings" \
    "js"

search_and_log "Icons Panel" \
    "Icons panel implementation" \
    "icons-panel|iconsPanel|IconsPanel" \
    "js"

search_and_log "Plugins Panel" \
    "Plugins panel implementation" \
    "plugins-panel|pluginsPanel|PluginsPanel" \
    "js"

# =================================================================
# 10. DRAG AND DROP
# =================================================================

search_and_log "Drag and Drop - Panels" \
    "Drag and drop functionality for panels" \
    "drag.*drop|sortable|reorder.*panel|move.*panel" \
    "js"

search_and_log "Drag and Drop - Docks" \
    "Drag and drop functionality for docks" \
    "drag.*dock|dock.*drag|sortable.*dock" \
    "js"

# =================================================================
# SUMMARY
# =================================================================

echo -e "${PURPLE}🎯 SEARCH COMPLETE${NC}"
echo "Results saved to: $OUTPUT_FILE"
echo ""
echo -e "${YELLOW}📊 SUMMARY STATS:${NC}"

# Count total files with matches
total_js_files=$(find . -name "*.js" | wc -l)
total_css_files=$(find . -name "*.css" | wc -l)

echo "   JavaScript files searched: $total_js_files"
echo "   CSS files searched: $total_css_files"
echo "   Results file: $OUTPUT_FILE"

# Generate summary
echo "" >> $OUTPUT_FILE
echo "## Search Summary" >> $OUTPUT_FILE
echo "- JavaScript files searched: $total_js_files" >> $OUTPUT_FILE
echo "- CSS files searched: $total_css_files" >> $OUTPUT_FILE
echo "- Search completed: $(date)" >> $OUTPUT_FILE

echo ""
echo -e "${GREEN}✅ Use 'cat $OUTPUT_FILE' to view all results${NC}"
echo -e "${GREEN}✅ Use the focused search scripts for specific components${NC}"