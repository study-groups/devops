#!/bin/bash

# =================================================================
# WORKSPACE SIDEBAR SCRUB - MAIN LAUNCHER
# =================================================================
# This is the main launcher script for scrubbing the codebase
# for everything related to WorkspaceManager's sidebar management
# =================================================================

echo "🧹 WORKSPACE SIDEBAR SYSTEM SCRUB"
echo "================================="
echo "Comprehensive codebase analysis for:"
echo "• WorkspaceManager sidebar management"
echo "• Docks (Settings, Controls, Logs)"
echo "• Panels and their fly-out capabilities"
echo "• Redux state tracking"
echo "• Single panel ownership mechanisms"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Check if scripts directory exists
if [ ! -d "scripts" ]; then
    echo -e "${RED}❌ Scripts directory not found!${NC}"
    echo "Please ensure you're running this from the project root."
    exit 1
fi

# Check if ripgrep is available
if ! command -v rg &> /dev/null; then
    echo -e "${YELLOW}⚠️  ripgrep (rg) not found. Trying to install...${NC}"
    if command -v apt-get &> /dev/null; then
        sudo apt-get update && sudo apt-get install -y ripgrep
    elif command -v brew &> /dev/null; then
        brew install ripgrep
    else
        echo -e "${RED}❌ Please install ripgrep manually: https://github.com/BurntSushi/ripgrep#installation${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"
echo ""

# Show available search options
echo -e "${CYAN}🔍 AVAILABLE SEARCH OPTIONS:${NC}"
echo "1. Run all searches (comprehensive analysis)"
echo "2. Workspace sidebar system only"
echo "3. Redux state tracking only"
echo "4. Panel components only"
echo "5. Dock system only"
echo "6. Sidebar management only"
echo "7. Custom search (specify pattern)"
echo "8. Quick dock/panel file listing"
echo ""

# Function to list relevant files quickly
quick_file_listing() {
    echo -e "${BLUE}📋 QUICK FILE LISTING${NC}"
    echo "===================="
    echo ""
    
    echo -e "${YELLOW}Files with 'dock' in name:${NC}"
    find . -iname "*dock*" -type f | head -20
    echo ""
    
    echo -e "${YELLOW}Files with 'panel' in name:${NC}"
    find . -iname "*panel*" -type f | head -20
    echo ""
    
    echo -e "${YELLOW}Files with 'sidebar' in name:${NC}"
    find . -iname "*sidebar*" -type f | head -20
    echo ""
    
    echo -e "${YELLOW}WorkspaceManager files:${NC}"
    find . -iname "*workspace*" -type f | head -10
    echo ""
    
    echo -e "${YELLOW}Key directories:${NC}"
    echo "📁 client/layout/ (workspace management)"
    echo "📁 client/panels/ (panel implementations)"
    echo "📁 client/store/ (Redux state)"
    echo "📁 client/sidebar/ (sidebar components)"
    echo ""
}

# Function to run a specific search
run_specific_search() {
    local script_name="$1"
    local description="$2"
    
    echo -e "${CYAN}🚀 Running: $description${NC}"
    echo ""
    
    if [ -f "scripts/$script_name" ]; then
        bash "scripts/$script_name"
        echo ""
        echo -e "${GREEN}✅ $description completed${NC}"
    else
        echo -e "${RED}❌ Script not found: scripts/$script_name${NC}"
    fi
}

# Interactive menu
read -p "Enter your choice (1-8): " choice

case $choice in
    1)
        echo -e "${PURPLE}🚀 Running comprehensive analysis...${NC}"
        bash scripts/run-all-searches.sh
        ;;
    2)
        run_specific_search "search-workspace-sidebar-system.sh" "Workspace Sidebar System Search"
        ;;
    3)
        run_specific_search "search-redux-state-tracking.sh" "Redux State Tracking Search"
        ;;
    4)
        run_specific_search "search-panel-components.sh" "Panel Components Search"
        ;;
    5)
        run_specific_search "search-dock-system.sh" "Dock System Search"
        ;;
    6)
        run_specific_search "search-sidebar-management.sh" "Sidebar Management Search"
        ;;
    7)
        echo -e "${YELLOW}Enter your custom search pattern:${NC}"
        read -p "Pattern: " pattern
        echo ""
        echo -e "${CYAN}🔍 Searching for: $pattern${NC}"
        rg -i -n -C 3 "$pattern" --type js . | head -50
        ;;
    8)
        quick_file_listing
        ;;
    *)
        echo -e "${RED}❌ Invalid choice. Please run the script again.${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${PURPLE}🎯 SCRUB COMPLETE${NC}"
echo ""
echo -e "${CYAN}📁 Key areas identified for WorkspaceManager sidebar management:${NC}"
echo "• Settings Dock: Manages design-tokens, theme-selector, css-settings, etc."
echo "• Controls Dock: Manages control panels and system controls"
echo "• Logs Dock: Manages logging and console panels"
echo "• Single Panel Ownership: Docks with one panel can assume the panel's name"
echo "• Fly-out System: Both docks and panels can be detached/floated"
echo "• Redux Tracking: All dock/panel state changes must be tracked in Redux"
echo ""
echo -e "${GREEN}✅ Use the generated results to understand and refactor the system${NC}"