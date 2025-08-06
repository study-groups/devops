#!/bin/bash

# =================================================================
# DOCK SYSTEM COMPREHENSIVE SEARCH
# =================================================================
# This script searches for everything related to the Dock system:
# Dock creation, management, Settings/Controls/Logs docks,
# single-panel ownership, and fly-out capabilities
# =================================================================

echo "🔍 DOCK SYSTEM COMPREHENSIVE SEARCH"
echo "==================================="
echo "Searching for: Dock definitions, management, ownership transfer"
echo "Focus: Settings Dock, Controls Dock, Logs Dock, fly-out system"
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
OUTPUT_FILE="dock-system-search-results.md"
echo "# Dock System Search Results" > $OUTPUT_FILE
echo "Generated on: $(date)" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

# Function to search and analyze dock-related code
search_dock_system() {
    local category="$1"
    local description="$2"
    local pattern="$3"
    local focus_dirs="$4"
    
    echo -e "${CYAN}🏗️  Searching: $category${NC}"
    echo "   $description"
    echo ""
    
    echo "## $category" >> $OUTPUT_FILE
    echo "$description" >> $OUTPUT_FILE
    echo "" >> $OUTPUT_FILE
    
    # Search with extended context for dock-related code
    if [ -n "$focus_dirs" ]; then
        for dir in $focus_dirs; do
            if [ -d "$dir" ]; then
                echo -e "${BLUE}   Analyzing: $dir${NC}"
                rg -i -n -C 5 --type js "$pattern" "$dir" >> temp_results.txt 2>/dev/null
            fi
        done
    else
        rg -i -n -C 5 --type js "$pattern" . >> temp_results.txt 2>/dev/null
    fi
    
    if [ -s temp_results.txt ]; then
        echo -e "${GREEN}✅ Found dock-related code:${NC}"
        cat temp_results.txt | head -40
        echo ""
        
        echo '```javascript' >> $OUTPUT_FILE
        cat temp_results.txt >> $OUTPUT_FILE
        echo '```' >> $OUTPUT_FILE
        echo "" >> $OUTPUT_FILE
        
        # Analyze files with matches
        echo -e "${YELLOW}   Files containing dock code:${NC}"
        grep -o '^[^:]*' temp_results.txt | sort | uniq | while read file; do
            echo "     📄 $file"
        done
        echo ""
    else
        echo -e "${RED}❌ No dock code found${NC}"
        echo ""
        echo "No matches found." >> $OUTPUT_FILE
        echo "" >> $OUTPUT_FILE
    fi
    
    rm -f temp_results.txt
}

# =================================================================
# 1. DOCK CORE SYSTEM
# =================================================================

search_dock_system "Dock Class Definition" \
    "Main Dock class and constructor" \
    "class.*Dock|function.*Dock|Dock.*constructor" \
    "client/layout client/panels"

search_dock_system "Dock Creation and Management" \
    "How docks are created, initialized, and managed" \
    "createDock|new.*Dock|initializeDock|manageDock|dock.*manager" \
    "client/layout client/panels"

search_dock_system "Dock Registry" \
    "Dock registration system and dock definitions" \
    "dockRegistry|registerDock|dockDefinitions|availableDocks" \
    "client/panels client/layout"

# =================================================================
# 2. SPECIFIC DOCK IMPLEMENTATIONS
# =================================================================

search_dock_system "Settings Dock Implementation" \
    "Settings dock creation, configuration, and management" \
    "settings-dock|settingsDock|Settings.*Dock|dock.*settings" \
    "client/panels client/settings"

search_dock_system "Controls Dock Implementation" \
    "Controls dock creation, configuration, and management" \
    "controls-dock|controlsDock|Controls.*Dock|dock.*controls" \
    "client/panels client/components"

search_dock_system "Logs Dock Implementation" \
    "Logs dock creation, configuration, and management" \
    "logs-dock|logsDock|Logs.*Dock|dock.*logs|log.*dock" \
    "client/panels client/log client/logging"

# =================================================================
# 3. DOCK STATE MANAGEMENT
# =================================================================

search_dock_system "Dock State in Redux" \
    "How dock state is managed in Redux store" \
    "state\..*docks|docks.*state|dock.*slice|dock.*reducer" \
    "client/store"

search_dock_system "Dock Visibility Management" \
    "Dock visibility, show/hide, toggle functionality" \
    "dock.*visible|visible.*dock|toggle.*dock|show.*dock|hide.*dock" \
    "client/layout client/store"

search_dock_system "Dock Panel Management" \
    "How docks manage their panels" \
    "dock.*panels|panels.*dock|dock\.panels|addPanel.*dock|removePanel.*dock" \
    "client/layout client/panels"

# =================================================================
# 4. SINGLE PANEL OWNERSHIP
# =================================================================

search_dock_system "Single Panel Dock Behavior" \
    "How docks with single panels take over naming" \
    "single.*panel.*dock|dock.*single.*panel|panel.*count.*1|panels\.length.*1" \
    "client/layout client/panels"

search_dock_system "Dock Name Takeover" \
    "Dock assuming panel name for real estate preservation" \
    "takeover.*name|assume.*panel.*name|dock.*title.*panel|panel.*title.*dock" \
    "client/layout client/panels"

search_dock_system "Real Estate Preservation" \
    "Code related to preserving UI real estate" \
    "preserve.*estate|real.*estate|space.*saving|compact.*mode" \
    "client/layout"

# =================================================================
# 5. FLY-OUT SYSTEM
# =================================================================

search_dock_system "Dock Fly-out Implementation" \
    "Dock fly-out, detachment, and floating capabilities" \
    "flyOut.*dock|dock.*flyOut|detach.*dock|dock.*detach|float.*dock" \
    "client/layout client/panels"

search_dock_system "Panel Fly-out from Dock" \
    "Panels flying out of their parent dock" \
    "flyOut.*panel|panel.*flyOut|detach.*panel|panel.*detach|parent.*dock" \
    "client/panels client/layout"

search_dock_system "Dock Windowing System" \
    "Docks becoming independent windows" \
    "dock.*window|window.*dock|floating.*dock|windowed.*dock" \
    "client/layout"

# =================================================================
# 6. DOCK ACTIONS AND EVENTS
# =================================================================

search_dock_system "Dock Redux Actions" \
    "Redux actions for dock operations" \
    "type.*dock|dock.*action|CREATE_DOCK|TOGGLE_DOCK|MOVE_DOCK|CLOSE_DOCK" \
    "client/store client/actions"

search_dock_system "Dock Event Handlers" \
    "Event handlers for dock interactions" \
    "on.*dock|dock.*event|dock.*handler|click.*dock|dock.*click" \
    "client/layout client/panels"

search_dock_system "Dock Keyboard Shortcuts" \
    "Keyboard shortcuts for dock operations" \
    "shortcut.*dock|dock.*shortcut|key.*dock|dock.*key|Ctrl.*Shift.*" \
    "client/keyboard client/layout"

# =================================================================
# 7. DOCK LAYOUT AND POSITIONING
# =================================================================

search_dock_system "Dock Zone Assignment" \
    "How docks are assigned to workspace zones" \
    "dock.*zone|zone.*dock|sidebar.*dock|dock.*sidebar" \
    "client/layout"

search_dock_system "Dock Positioning" \
    "Dock positioning and layout management" \
    "dock.*position|position.*dock|dock.*layout|layout.*dock" \
    "client/layout"

search_dock_system "Dock Resizing" \
    "Dock resizing capabilities" \
    "dock.*resize|resize.*dock|dock.*width|dock.*height" \
    "client/layout"

# =================================================================
# 8. DOCK DRAG AND DROP
# =================================================================

search_dock_system "Dock Drag and Drop" \
    "Drag and drop functionality for docks" \
    "drag.*dock|dock.*drag|drop.*dock|dock.*drop|sortable.*dock" \
    "client/panels client/layout"

search_dock_system "Panel-to-Dock Drag Drop" \
    "Dragging panels between docks" \
    "drag.*panel.*dock|panel.*drag.*dock|drop.*panel.*dock" \
    "client/panels"

# =================================================================
# 9. DOCK CONFIGURATION
# =================================================================

search_dock_system "Dock Configuration" \
    "Dock configuration and customization" \
    "dock.*config|config.*dock|dock.*settings|configure.*dock" \
    "client/layout client/panels"

search_dock_system "Default Dock Setup" \
    "Default dock configuration and initialization" \
    "default.*dock|dock.*default|initial.*dock|dock.*initial" \
    "client/layout"

# =================================================================
# 10. DOCK PERSISTENCE
# =================================================================

search_dock_system "Dock State Persistence" \
    "Saving and loading dock state" \
    "persist.*dock|dock.*persist|save.*dock|load.*dock|dock.*storage" \
    "client/store"

# =================================================================
# 11. DOCK CSS AND STYLING
# =================================================================

echo -e "${BLUE}🎨 Searching for dock-related CSS...${NC}"
echo "## Dock CSS and Styling" >> $OUTPUT_FILE

find . -name "*.css" -exec grep -l -i "dock" {} \; | while read file; do
    echo "### CSS File: $file" >> $OUTPUT_FILE
    echo '```css' >> $OUTPUT_FILE
    grep -i -n -C 3 "dock" "$file" >> $OUTPUT_FILE 2>/dev/null
    echo '```' >> $OUTPUT_FILE
    echo "" >> $OUTPUT_FILE
done

# =================================================================
# 12. DOCK FILE STRUCTURE ANALYSIS
# =================================================================

echo -e "${PURPLE}📁 Analyzing dock-related file structure...${NC}"
echo "## Dock File Structure Analysis" >> $OUTPUT_FILE

echo "### Files with 'dock' in name:" >> $OUTPUT_FILE
find . -iname "*dock*" -type f | sort >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

echo "### Directories with 'dock' in name:" >> $OUTPUT_FILE
find . -iname "*dock*" -type d | sort >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

# =================================================================
# 13. SPECIFIC DOCK SEARCHES
# =================================================================

search_dock_system "WorkspaceManager Dock Integration" \
    "How WorkspaceManager integrates with dock system" \
    "WorkspaceManager.*dock|dock.*WorkspaceManager|workspace.*dock" \
    "client/layout"

search_dock_system "Dock Rendering" \
    "How docks are rendered in the UI" \
    "render.*dock|dock.*render|renderDock|dock.*component" \
    "client/layout client/panels"

# =================================================================
# SUMMARY AND ANALYSIS
# =================================================================

echo -e "${PURPLE}🎯 DOCK SYSTEM SEARCH COMPLETE${NC}"
echo "Results saved to: $OUTPUT_FILE"
echo ""

# Count dock-related files
dock_js_files=$(find . -name "*.js" -exec grep -l -i "dock" {} \; | wc -l)
dock_css_files=$(find . -name "*.css" -exec grep -l -i "dock" {} \; | wc -l)
dock_named_files=$(find . -iname "*dock*" | wc -l)

echo -e "${YELLOW}📊 DOCK SYSTEM STATISTICS:${NC}"
echo "   JavaScript files mentioning docks: $dock_js_files"
echo "   CSS files with dock styles: $dock_css_files"
echo "   Files with 'dock' in name: $dock_named_files"

echo "" >> $OUTPUT_FILE
echo "## Dock System Analysis Summary" >> $OUTPUT_FILE
echo "This search analyzed the complete dock system including:" >> $OUTPUT_FILE
echo "- Dock class definitions and management" >> $OUTPUT_FILE
echo "- Settings, Controls, and Logs dock implementations" >> $OUTPUT_FILE
echo "- Single panel ownership and name takeover" >> $OUTPUT_FILE
echo "- Fly-out and windowing capabilities" >> $OUTPUT_FILE
echo "- Redux state management for docks" >> $OUTPUT_FILE
echo "- Drag and drop functionality" >> $OUTPUT_FILE
echo "- Layout and positioning system" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE
echo "### Statistics:" >> $OUTPUT_FILE
echo "- JavaScript files mentioning docks: $dock_js_files" >> $OUTPUT_FILE
echo "- CSS files with dock styles: $dock_css_files" >> $OUTPUT_FILE
echo "- Files with 'dock' in name: $dock_named_files" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE
echo "Search completed: $(date)" >> $OUTPUT_FILE

echo ""
echo -e "${GREEN}✅ Use 'cat $OUTPUT_FILE' to view comprehensive dock system analysis${NC}"