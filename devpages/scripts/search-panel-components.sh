#!/bin/bash

# =================================================================
# PANEL COMPONENTS DETAILED SEARCH
# =================================================================
# This script searches for all panel-related components, their
# implementations, registrations, and relationships
# =================================================================

echo "🔍 PANEL COMPONENTS DETAILED SEARCH"
echo "==================================="
echo "Searching for: Panel implementations, registrations, configurations"
echo "Focus: Settings, Controls, Logs panels and their components"
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
OUTPUT_FILE="panel-components-search-results.md"
echo "# Panel Components Search Results" > $OUTPUT_FILE
echo "Generated on: $(date)" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

# Function to search with file structure analysis
search_with_structure() {
    local category="$1"
    local description="$2"
    local pattern="$3"
    local directories="$4"
    
    echo -e "${CYAN}📂 Searching: $category${NC}"
    echo "   $description"
    echo ""
    
    echo "## $category" >> $OUTPUT_FILE
    echo "$description" >> $OUTPUT_FILE
    echo "" >> $OUTPUT_FILE
    
    # Search in specific directories if provided
    if [ -n "$directories" ]; then
        for dir in $directories; do
            if [ -d "$dir" ]; then
                echo -e "${BLUE}   Searching in: $dir${NC}"
                echo "### Directory: $dir" >> $OUTPUT_FILE
                rg -i -n -C 2 --type js "$pattern" "$dir" >> temp_results.txt 2>/dev/null
            fi
        done
    else
        rg -i -n -C 2 --type js "$pattern" . >> temp_results.txt 2>/dev/null
    fi
    
    if [ -s temp_results.txt ]; then
        echo -e "${GREEN}✅ Found matches:${NC}"
        cat temp_results.txt | head -30
        echo ""
        
        echo '```' >> $OUTPUT_FILE
        cat temp_results.txt >> $OUTPUT_FILE
        echo '```' >> $OUTPUT_FILE
        echo "" >> $OUTPUT_FILE
        
        # Show file list
        echo -e "${YELLOW}   Files with matches:${NC}"
        grep -o '^[^:]*' temp_results.txt | sort | uniq | while read file; do
            echo "     $file"
        done
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
# 1. PANEL REGISTRY AND DEFINITIONS
# =================================================================

search_with_structure "Panel Registry System" \
    "Panel registration, definitions, and configurations" \
    "panelRegistry|panelDefinitions|registerPanel|panelConfig" \
    "client/panels"

search_with_structure "Panel Base Classes" \
    "Base panel classes and interfaces" \
    "BasePanel|PanelInterface|Panel.*class|extends.*Panel" \
    "client/panels"

# =================================================================
# 2. SETTINGS PANELS
# =================================================================

search_with_structure "Design Tokens Panel" \
    "Design tokens panel implementation and usage" \
    "design-tokens|designTokens|DesignTokensPanel|DesignToken" \
    "client/panels client/settings"

search_with_structure "Theme Selector Panel" \
    "Theme selector panel implementation" \
    "theme-selector|themeSelector|ThemeSelector|theme.*panel" \
    "client/panels client/settings"

search_with_structure "CSS Settings Panel" \
    "CSS settings panel implementation" \
    "css-settings|cssSettings|CssSettings|css.*panel" \
    "client/panels client/settings"

search_with_structure "Preview Settings Panel" \
    "Preview settings panel implementation" \
    "preview-settings|previewSettings|PreviewSettings|preview.*panel" \
    "client/panels client/preview"

search_with_structure "Icons Panel" \
    "Icons panel implementation" \
    "icons-panel|iconsPanel|IconsPanel|icon.*panel" \
    "client/panels"

search_with_structure "Plugins Panel" \
    "Plugins panel implementation" \
    "plugins-panel|pluginsPanel|PluginsPanel|plugin.*panel" \
    "client/panels"

# =================================================================
# 3. CONTROL PANELS
# =================================================================

search_with_structure "Control Panels" \
    "Control-related panels and their implementations" \
    "control.*panel|ControlPanel|controls.*panel" \
    "client/panels client/components"

search_with_structure "Debug Controls" \
    "Debug control panels" \
    "debug.*control|DebugControl|debug.*panel" \
    "client/panels client/debug"

search_with_structure "System Controls" \
    "System control panels" \
    "system.*control|SystemControl|system.*panel" \
    "client/panels"

# =================================================================
# 4. LOG PANELS
# =================================================================

search_with_structure "Log Panels" \
    "Log panel implementations" \
    "log.*panel|LogPanel|logging.*panel|console.*panel" \
    "client/panels client/log client/logging"

search_with_structure "Log Management" \
    "Log management and display" \
    "log.*manager|LogManager|log.*display|log.*viewer" \
    "client/log client/logging"

# =================================================================
# 5. PANEL RENDERING
# =================================================================

search_with_structure "Panel Renderers" \
    "Panel rendering system" \
    "PanelRenderer|panel.*render|render.*panel" \
    "client/panels"

search_with_structure "Panel Navigation" \
    "Panel navigation and control components" \
    "PanelNavBar|panel.*nav|nav.*panel" \
    "client/panels"

search_with_structure "Panel Control Center" \
    "Panel control center implementation" \
    "PanelControlCenter|control.*center" \
    "client/panels"

# =================================================================
# 6. PANEL STATE MANAGEMENT
# =================================================================

search_with_structure "Panel State Manager" \
    "Panel state management components" \
    "PanelStateManager|panel.*state.*manager" \
    "client/panels"

search_with_structure "Panel Configuration" \
    "Panel configuration and settings" \
    "panel.*config|panelConfig|config.*panel" \
    "client/panels"

# =================================================================
# 7. DRAG AND DROP
# =================================================================

search_with_structure "Panel Drag and Drop" \
    "Drag and drop functionality for panels" \
    "DragDropManager|drag.*drop.*panel|sortable.*panel" \
    "client/panels"

# =================================================================
# 8. PANEL TYPES
# =================================================================

search_with_structure "Editor Panels" \
    "Editor-related panels" \
    "EditorPanel|editor.*panel" \
    "client/panels"

search_with_structure "Code Panels" \
    "Code-related panels" \
    "CodePanel|code.*panel|JavaScriptPanel|HtmlPanel" \
    "client/panels"

search_with_structure "Preview Panels" \
    "Preview-related panels" \
    "PreviewPanel|preview.*panel" \
    "client/panels client/preview"

search_with_structure "Context Panels" \
    "Context-related panels" \
    "ContextPanel|context.*panel" \
    "client/panels"

search_with_structure "NLP Panels" \
    "NLP-related panels" \
    "NlpPanel|nlp.*panel" \
    "client/panels"

# =================================================================
# 9. PANEL STYLING
# =================================================================

search_with_structure "Panel CSS Styles" \
    "CSS styles for panels" \
    "\.panel|panel.*css|css.*panel" \
    "client/panels"

echo -e "${BLUE}📄 Searching CSS files for panel styles...${NC}"
echo "## Panel CSS Styles" >> $OUTPUT_FILE
find . -name "*.css" -exec grep -l -i "panel\|dock" {} \; | while read file; do
    echo "### CSS File: $file" >> $OUTPUT_FILE
    echo '```css' >> $OUTPUT_FILE
    grep -i -n -C 2 "panel\|dock" "$file" >> $OUTPUT_FILE 2>/dev/null
    echo '```' >> $OUTPUT_FILE
    echo "" >> $OUTPUT_FILE
done

# =================================================================
# 10. PANEL INTEGRATION
# =================================================================

search_with_structure "Panel-WorkspaceManager Integration" \
    "How panels integrate with WorkspaceManager" \
    "WorkspaceManager.*panel|panel.*WorkspaceManager|workspace.*panel" \
    "client/layout"

search_with_structure "Panel-Redux Integration" \
    "How panels integrate with Redux store" \
    "panel.*store|store.*panel|panel.*dispatch|dispatch.*panel" \
    "client/panels"

# =================================================================
# 11. PANEL LIFECYCLE
# =================================================================

search_with_structure "Panel Lifecycle Methods" \
    "Panel lifecycle methods (create, destroy, etc.)" \
    "create.*panel|destroy.*panel|mount.*panel|unmount.*panel|panel.*lifecycle" \
    "client/panels"

search_with_structure "Panel Initialization" \
    "Panel initialization and setup" \
    "init.*panel|panel.*init|setup.*panel|panel.*setup" \
    "client/panels"

# =================================================================
# 12. SPECIFIC PANEL SEARCHES
# =================================================================

echo -e "${PURPLE}📋 Listing all panel files...${NC}"
echo "## Panel File Structure" >> $OUTPUT_FILE
echo "### JavaScript Panel Files" >> $OUTPUT_FILE
find . -name "*[Pp]anel*.js" -type f | sort >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

echo "### CSS Panel Files" >> $OUTPUT_FILE
find . -name "*[Pp]anel*.css" -type f | sort >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

# =================================================================
# SUMMARY
# =================================================================

echo -e "${PURPLE}🎯 PANEL COMPONENTS SEARCH COMPLETE${NC}"
echo "Results saved to: $OUTPUT_FILE"
echo ""

# Count statistics
total_panel_js=$(find . -name "*[Pp]anel*.js" | wc -l)
total_panel_css=$(find . -name "*[Pp]anel*.css" | wc -l)

echo -e "${YELLOW}📊 PANEL STATISTICS:${NC}"
echo "   Panel JavaScript files: $total_panel_js"
echo "   Panel CSS files: $total_panel_css"

echo "" >> $OUTPUT_FILE
echo "## Panel Components Summary" >> $OUTPUT_FILE
echo "- Panel JavaScript files found: $total_panel_js" >> $OUTPUT_FILE
echo "- Panel CSS files found: $total_panel_css" >> $OUTPUT_FILE
echo "- Search completed: $(date)" >> $OUTPUT_FILE

echo ""
echo -e "${GREEN}✅ Use 'cat $OUTPUT_FILE' to view detailed panel analysis${NC}"