#!/bin/bash

# =================================================================
# SIDEBAR MANAGEMENT COMPREHENSIVE SEARCH
# =================================================================
# This script searches for everything related to sidebar management:
# Sidebar zones, dock placement, panel organization,
# and WorkspaceManager's sidebar control
# =================================================================

echo "🔍 SIDEBAR MANAGEMENT COMPREHENSIVE SEARCH"
echo "=========================================="
echo "Searching for: Sidebar zones, dock placement, panel organization"
echo "Focus: WorkspaceManager sidebar control, left zone management"
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
OUTPUT_FILE="sidebar-management-search-results.md"
echo "# Sidebar Management Search Results" > $OUTPUT_FILE
echo "Generated on: $(date)" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

# Function to search and analyze sidebar-related code
search_sidebar_system() {
    local category="$1"
    local description="$2"
    local pattern="$3"
    local focus_dirs="$4"
    
    echo -e "${CYAN}📋 Searching: $category${NC}"
    echo "   $description"
    echo ""
    
    echo "## $category" >> $OUTPUT_FILE
    echo "$description" >> $OUTPUT_FILE
    echo "" >> $OUTPUT_FILE
    
    # Search with context for sidebar-related code
    if [ -n "$focus_dirs" ]; then
        for dir in $focus_dirs; do
            if [ -d "$dir" ]; then
                echo -e "${BLUE}   Analyzing: $dir${NC}"
                rg -i -n -C 4 --type js "$pattern" "$dir" >> temp_results.txt 2>/dev/null
            fi
        done
    else
        rg -i -n -C 4 --type js "$pattern" . >> temp_results.txt 2>/dev/null
    fi
    
    if [ -s temp_results.txt ]; then
        echo -e "${GREEN}✅ Found sidebar code:${NC}"
        cat temp_results.txt | head -35
        echo ""
        
        echo '```javascript' >> $OUTPUT_FILE
        cat temp_results.txt >> $OUTPUT_FILE
        echo '```' >> $OUTPUT_FILE
        echo "" >> $OUTPUT_FILE
        
        # Show files with matches
        echo -e "${YELLOW}   Files with sidebar code:${NC}"
        grep -o '^[^:]*' temp_results.txt | sort | uniq | while read file; do
            echo "     📄 $file"
        done
        echo ""
    else
        echo -e "${RED}❌ No sidebar code found${NC}"
        echo ""
        echo "No matches found." >> $OUTPUT_FILE
        echo "" >> $OUTPUT_FILE
    fi
    
    rm -f temp_results.txt
}

# =================================================================
# 1. SIDEBAR CORE SYSTEM
# =================================================================

search_sidebar_system "Sidebar Zone Definition" \
    "How sidebar zones are defined and managed" \
    "sidebar.*zone|workspace-sidebar|semanticZones.*sidebar" \
    "client/layout"

search_sidebar_system "Sidebar DOM Management" \
    "Sidebar DOM element management and manipulation" \
    "getElementById.*sidebar|querySelector.*sidebar|sidebar.*element" \
    "client/layout"

search_sidebar_system "Sidebar Initialization" \
    "Sidebar setup and initialization in WorkspaceManager" \
    "init.*sidebar|sidebar.*init|setup.*sidebar|sidebar.*setup" \
    "client/layout"

# =================================================================
# 2. WORKSPACEMANAGER SIDEBAR INTEGRATION
# =================================================================

search_sidebar_system "WorkspaceManager Sidebar Control" \
    "How WorkspaceManager controls the sidebar" \
    "WorkspaceManager.*sidebar|sidebar.*WorkspaceManager|this\..*sidebar" \
    "client/layout"

search_sidebar_system "Sidebar Semantic Zones" \
    "Semantic zone mapping for sidebar" \
    "semanticZones|semantic.*zone.*sidebar|sidebar.*semantic" \
    "client/layout"

search_sidebar_system "Sidebar Rendering" \
    "How sidebar content is rendered" \
    "render.*sidebar|sidebar.*render|renderSidebar" \
    "client/layout"

# =================================================================
# 3. SIDEBAR DOCK MANAGEMENT
# =================================================================

search_sidebar_system "Sidebar Dock Placement" \
    "How docks are placed in the sidebar" \
    "sidebar.*dock|dock.*sidebar|zone.*sidebar.*dock" \
    "client/layout client/panels"

search_sidebar_system "Sidebar Dock Organization" \
    "Organization and ordering of docks in sidebar" \
    "sidebar.*order|order.*sidebar|dock.*order.*sidebar" \
    "client/layout"

search_sidebar_system "Sidebar Dock Visibility" \
    "Sidebar dock visibility management" \
    "sidebar.*visible|visible.*sidebar|show.*sidebar|hide.*sidebar" \
    "client/layout"

# =================================================================
# 4. SIDEBAR PANEL MANAGEMENT
# =================================================================

search_sidebar_system "Sidebar Panel System" \
    "How panels are managed in the sidebar" \
    "sidebarPanels|sidebar.*panel|panel.*sidebar" \
    "client/layout client/panels client/store"

search_sidebar_system "Sidebar Panel Registration" \
    "Panel registration for sidebar placement" \
    "registerPanel.*sidebar|sidebar.*registerPanel|zone.*sidebar" \
    "client/panels client/store"

search_sidebar_system "Sidebar Panel State" \
    "Sidebar panel state management" \
    "state.*sidebarPanels|sidebarPanels.*state|sidebar.*panel.*state" \
    "client/store"

# =================================================================
# 5. SIDEBAR SCROLLING AND LAYOUT
# =================================================================

search_sidebar_system "Sidebar Scrolling" \
    "Sidebar scrolling functionality" \
    "sidebar.*scroll|overflowY.*auto|scroll.*sidebar" \
    "client/layout"

search_sidebar_system "Sidebar Height Management" \
    "Sidebar height and sizing" \
    "sidebar.*height|height.*sidebar|sidebar.*100%" \
    "client/layout"

search_sidebar_system "Sidebar Flexbox Layout" \
    "Sidebar flexbox and layout properties" \
    "sidebar.*flex|flex.*sidebar|flexBasis.*sidebar" \
    "client/layout"

# =================================================================
# 6. SIDEBAR RESIZING
# =================================================================

search_sidebar_system "Sidebar Resizing System" \
    "Sidebar resizing capabilities" \
    "resize.*sidebar|sidebar.*resize|resizer.*left|left.*resizer" \
    "client/layout"

search_sidebar_system "Sidebar Width Management" \
    "Sidebar width control and adjustment" \
    "sidebar.*width|width.*sidebar|sidebar.*flexBasis" \
    "client/layout"

# =================================================================
# 7. SIDEBAR STATE MANAGEMENT
# =================================================================

search_sidebar_system "Sidebar Redux State" \
    "Sidebar state in Redux store" \
    "sidebar.*state|state.*sidebar|sidebar.*slice" \
    "client/store"

search_sidebar_system "Sidebar Visibility State" \
    "Sidebar visibility in application state" \
    "sidebar.*visible|visible.*sidebar|toggle.*sidebar" \
    "client/store client/layout"

# =================================================================
# 8. SIDEBAR EVENTS AND INTERACTIONS
# =================================================================

search_sidebar_system "Sidebar Event Handlers" \
    "Event handling for sidebar interactions" \
    "sidebar.*event|event.*sidebar|click.*sidebar|sidebar.*click" \
    "client/layout"

search_sidebar_system "Sidebar Keyboard Shortcuts" \
    "Keyboard shortcuts for sidebar operations" \
    "sidebar.*shortcut|shortcut.*sidebar|key.*sidebar" \
    "client/keyboard client/layout"

# =================================================================
# 9. LEFT ZONE SYSTEM
# =================================================================

search_sidebar_system "Left Zone Management" \
    "Left zone/sidebar management system" \
    "left.*zone|zone.*left|LEFT_ZONE|leftZone" \
    "client/layout"

search_sidebar_system "Left Zone Docks" \
    "Dock system in left zone" \
    "left.*zone.*dock|dock.*left.*zone|left.*dock" \
    "client/layout"

# =================================================================
# 10. SIDEBAR CONTENT MANAGEMENT
# =================================================================

search_sidebar_system "Sidebar Content Rendering" \
    "How content is rendered in sidebar" \
    "sidebar.*content|content.*sidebar|renderSidebarContent" \
    "client/layout"

search_sidebar_system "Sidebar Empty State" \
    "Sidebar empty state handling" \
    "sidebar.*empty|empty.*sidebar|no.*sidebar.*content" \
    "client/layout"

# =================================================================
# 11. SIDEBAR CSS AND STYLING
# =================================================================

echo -e "${BLUE}🎨 Searching for sidebar CSS...${NC}"
echo "## Sidebar CSS and Styling" >> $OUTPUT_FILE

# Search CSS files for sidebar styles
find . -name "*.css" -exec grep -l -i "sidebar\|left.*zone" {} \; | while read file; do
    echo "### CSS File: $file" >> $OUTPUT_FILE
    echo '```css' >> $OUTPUT_FILE
    grep -i -n -C 3 "sidebar\|left.*zone\|workspace-sidebar" "$file" >> $OUTPUT_FILE 2>/dev/null
    echo '```' >> $OUTPUT_FILE
    echo "" >> $OUTPUT_FILE
done

# =================================================================
# 12. SIDEBAR CONFIGURATION
# =================================================================

search_sidebar_system "Sidebar Configuration" \
    "Sidebar configuration and settings" \
    "sidebar.*config|config.*sidebar|sidebar.*settings" \
    "client/layout client/settings"

search_sidebar_system "Default Sidebar Setup" \
    "Default sidebar configuration" \
    "default.*sidebar|sidebar.*default|initial.*sidebar" \
    "client/layout"

# =================================================================
# 13. SIDEBAR DRAG AND DROP
# =================================================================

search_sidebar_system "Sidebar Drag and Drop" \
    "Drag and drop in sidebar" \
    "sidebar.*drag|drag.*sidebar|sidebar.*drop|drop.*sidebar" \
    "client/layout client/panels"

# =================================================================
# 14. SIDEBAR API
# =================================================================

search_sidebar_system "Sidebar API Methods" \
    "Public API methods for sidebar control" \
    "sidebar.*api|api.*sidebar|toggleSidebar|showSidebar|hideSidebar" \
    "client/layout"

# =================================================================
# 15. SIDEBAR PERSISTENCE
# =================================================================

search_sidebar_system "Sidebar State Persistence" \
    "Saving and loading sidebar state" \
    "persist.*sidebar|sidebar.*persist|save.*sidebar|load.*sidebar" \
    "client/store"

# =================================================================
# FILE STRUCTURE ANALYSIS
# =================================================================

echo -e "${PURPLE}📁 Analyzing sidebar file structure...${NC}"
echo "## Sidebar File Structure" >> $OUTPUT_FILE

echo "### Files with 'sidebar' in name:" >> $OUTPUT_FILE
find . -iname "*sidebar*" -type f | sort >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

echo "### Files mentioning sidebar (sample):" >> $OUTPUT_FILE
grep -r -l -i "sidebar" --include="*.js" . | head -20 | sort >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

# =================================================================
# SPECIFIC SIDEBAR COMPONENT SEARCHES
# =================================================================

search_sidebar_system "Sidebar Navigation Components" \
    "Navigation components in sidebar" \
    "sidebar.*nav|nav.*sidebar|SidebarNav" \
    "client/components client/sidebar"

search_sidebar_system "Sidebar Toggle Components" \
    "Components for toggling sidebar" \
    "SidebarToggle|toggle.*sidebar|sidebar.*toggle" \
    "client/components"

# =================================================================
# SUMMARY AND ANALYSIS
# =================================================================

echo -e "${PURPLE}🎯 SIDEBAR MANAGEMENT SEARCH COMPLETE${NC}"
echo "Results saved to: $OUTPUT_FILE"
echo ""

# Count sidebar-related files
sidebar_js_files=$(grep -r -l -i "sidebar" --include="*.js" . | wc -l)
sidebar_css_files=$(grep -r -l -i "sidebar" --include="*.css" . | wc -l)
sidebar_named_files=$(find . -iname "*sidebar*" | wc -l)

echo -e "${YELLOW}📊 SIDEBAR SYSTEM STATISTICS:${NC}"
echo "   JavaScript files mentioning sidebar: $sidebar_js_files"
echo "   CSS files with sidebar styles: $sidebar_css_files"
echo "   Files with 'sidebar' in name: $sidebar_named_files"

echo "" >> $OUTPUT_FILE
echo "## Sidebar Management Analysis Summary" >> $OUTPUT_FILE
echo "This search analyzed the complete sidebar management system including:" >> $OUTPUT_FILE
echo "- Sidebar zone definition and DOM management" >> $OUTPUT_FILE
echo "- WorkspaceManager sidebar integration" >> $OUTPUT_FILE
echo "- Sidebar dock and panel placement" >> $OUTPUT_FILE
echo "- Sidebar scrolling and layout management" >> $OUTPUT_FILE
echo "- Sidebar resizing capabilities" >> $OUTPUT_FILE
echo "- Sidebar state management in Redux" >> $OUTPUT_FILE
echo "- Left zone system implementation" >> $OUTPUT_FILE
echo "- Sidebar events and interactions" >> $OUTPUT_FILE
echo "- Sidebar styling and CSS" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE
echo "### Statistics:" >> $OUTPUT_FILE
echo "- JavaScript files mentioning sidebar: $sidebar_js_files" >> $OUTPUT_FILE
echo "- CSS files with sidebar styles: $sidebar_css_files" >> $OUTPUT_FILE
echo "- Files with 'sidebar' in name: $sidebar_named_files" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE
echo "Search completed: $(date)" >> $OUTPUT_FILE

echo ""
echo -e "${GREEN}✅ Use 'cat $OUTPUT_FILE' to view comprehensive sidebar analysis${NC}"