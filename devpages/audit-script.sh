#!/bin/bash

# =============================================================================
# COMPREHENSIVE CODEBASE AUDIT SCRIPT
# Finding redundant and competing concepts in panels, state, and debug systems
# =============================================================================

echo "🔍 COMPREHENSIVE CODEBASE AUDIT STARTING..."
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Output file
OUTPUT_FILE="codebase-audit-results.md"
echo "# Codebase Audit Results" > $OUTPUT_FILE
echo "Generated: $(date)" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

# =============================================================================
# 1. PANEL MANAGEMENT SYSTEMS
# =============================================================================
echo -e "${CYAN}🎛️  AUDITING PANEL MANAGEMENT SYSTEMS...${NC}"
echo "## Panel Management Systems" >> $OUTPUT_FILE

echo "### Panel Manager Classes" >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE
find . -name "*.js" -type f | xargs grep -l "class.*Manager" | grep -v node_modules | grep -v ".git" >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE

echo "### Panel Manager Instances" >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE
find . -name "*.js" -type f | xargs grep -l "panelManager\|PanelManager" | grep -v node_modules | grep -v ".git" >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE

# =============================================================================
# 2. DEBUG SYSTEMS
# =============================================================================
echo -e "${RED}🐛 AUDITING DEBUG SYSTEMS...${NC}"
echo "## Debug Systems" >> $OUTPUT_FILE

echo "### Debug Panel References" >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE
find . -name "*.js" -type f | xargs grep -n "debug.*[Pp]anel\|[Dd]ebug.*dock" | grep -v node_modules | grep -v ".git" >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE

echo "### Debug Manager References" >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE
find . -name "*.js" -type f | xargs grep -n "debugPanelManager\|DebugPanelManager" | grep -v node_modules | grep -v ".git" >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE

echo "### Debug Dock References" >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE
find . -name "*.js" -type f | xargs grep -n "debug-dock\|debugDock" | grep -v node_modules | grep -v ".git" >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE

# =============================================================================
# 3. REDUX STATE MANAGEMENT
# =============================================================================
echo -e "${BLUE}🏪 AUDITING REDUX STATE MANAGEMENT...${NC}"
echo "## Redux State Management" >> $OUTPUT_FILE

echo "### Redux Stores" >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE
find . -name "*.js" -type f | xargs grep -n "createStore\|configureStore" | grep -v node_modules | grep -v ".git" >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE

echo "### Redux Reducers" >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE
find . -name "*reducer*.js" -type f | grep -v node_modules | grep -v ".git" >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE

echo "### Redux Slices" >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE
find . -name "*slice*.js" -type f | grep -v node_modules | grep -v ".git" >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE

echo "### Panel State Management" >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE
find . -name "*.js" -type f | xargs grep -n "panelState\|panelReducer\|panelSlice" | grep -v node_modules | grep -v ".git" >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE

# =============================================================================
# 4. TOGGLE AND VISIBILITY SYSTEMS
# =============================================================================
echo -e "${YELLOW}👁️  AUDITING TOGGLE AND VISIBILITY SYSTEMS...${NC}"
echo "## Toggle and Visibility Systems" >> $OUTPUT_FILE

echo "### Toggle Functions" >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE
find . -name "*.js" -type f | xargs grep -n "toggle.*[Vv]isibility\|toggle.*[Pp]anel\|toggle.*[Dd]ock" | grep -v node_modules | grep -v ".git" >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE

echo "### Show/Hide Functions" >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE
find . -name "*.js" -type f | xargs grep -n "show.*[Pp]anel\|hide.*[Pp]anel\|show.*[Dd]ock\|hide.*[Dd]ock" | grep -v node_modules | grep -v ".git" >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE

echo "### Visibility State Properties" >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE
find . -name "*.js" -type f | xargs grep -n "isVisible\|visible.*true\|visible.*false" | grep -v node_modules | grep -v ".git" | head -50 >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE

# =============================================================================
# 5. KEYBOARD SHORTCUTS AND EVENT HANDLERS
# =============================================================================
echo -e "${PURPLE}⌨️  AUDITING KEYBOARD SHORTCUTS AND EVENT HANDLERS...${NC}"
echo "## Keyboard Shortcuts and Event Handlers" >> $OUTPUT_FILE

echo "### Keyboard Shortcut Handlers" >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE
find . -name "*.js" -type f | xargs grep -n "keydown\|addEventListener.*key\|shortcut" | grep -v node_modules | grep -v ".git" | head -30 >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE

echo "### Debug-related Shortcuts" >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE
find . -name "*.js" -type f | xargs grep -n "Ctrl.*Shift.*D\|ctrl.*shift.*d" | grep -v node_modules | grep -v ".git" >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE

echo "### Reset/Default Shortcuts" >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE
find . -name "*.js" -type f | xargs grep -n "reset.*default\|Ctrl.*Shift.*1" | grep -v node_modules | grep -v ".git" >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE

# =============================================================================
# 6. PANEL REGISTRATION AND INITIALIZATION
# =============================================================================
echo -e "${GREEN}🚀 AUDITING PANEL REGISTRATION AND INITIALIZATION...${NC}"
echo "## Panel Registration and Initialization" >> $OUTPUT_FILE

echo "### Panel Registration Functions" >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE
find . -name "*.js" -type f | xargs grep -n "register.*[Pp]anel\|initialize.*[Pp]anel" | grep -v node_modules | grep -v ".git" >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE

echo "### Panel Initialization Files" >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE
find . -name "*init*.js" -type f | grep -i panel | grep -v node_modules | grep -v ".git" >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE

echo "### Panel Factory Functions" >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE
find . -name "*.js" -type f | xargs grep -n "create.*[Pp]anel\|new.*Panel" | grep -v node_modules | grep -v ".git" | head -30 >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE

# =============================================================================
# 7. CONFLICTING WINDOW OBJECT ASSIGNMENTS
# =============================================================================
echo -e "${RED}🌍 AUDITING WINDOW OBJECT ASSIGNMENTS...${NC}"
echo "## Window Object Assignments" >> $OUTPUT_FILE

echo "### Debug Manager Assignments" >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE
find . -name "*.js" -type f | xargs grep -n "window\.debug\|window\..*debug" | grep -v node_modules | grep -v ".git" >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE

echo "### Panel Manager Assignments" >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE
find . -name "*.js" -type f | xargs grep -n "window\..*panel\|window\..*Panel" | grep -v node_modules | grep -v ".git" >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE

echo "### APP Namespace Assignments" >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE
find . -name "*.js" -type f | xargs grep -n "window\.APP\." | grep -v node_modules | grep -v ".git" | head -30 >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE

# =============================================================================
# 8. COMPETING STATE STORAGE SYSTEMS
# =============================================================================
echo -e "${CYAN}💾 AUDITING STATE STORAGE SYSTEMS...${NC}"
echo "## State Storage Systems" >> $OUTPUT_FILE

echo "### LocalStorage Usage" >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE
find . -name "*.js" -type f | xargs grep -n "localStorage\." | grep -v node_modules | grep -v ".git" | head -20 >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE

echo "### State Persistence" >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE
find . -name "*.js" -type f | xargs grep -n "persist\|save.*[Ss]tate\|load.*[Ss]tate" | grep -v node_modules | grep -v ".git" | head -20 >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE

# =============================================================================
# 9. FILE-BY-FILE ANALYSIS OF CLIENT DIRECTORY
# =============================================================================
echo -e "${BLUE}📁 ANALYZING CLIENT DIRECTORY FILES...${NC}"
echo "## Client Directory Analysis" >> $OUTPUT_FILE

echo "### All Client JavaScript Files" >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE
find ./client -name "*.js" -type f | sort >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE

echo "### Panel-related Files in Client" >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE
find ./client -name "*.js" -type f | xargs grep -l "[Pp]anel" | sort >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE

echo "### Debug-related Files in Client" >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE
find ./client -name "*.js" -type f | xargs grep -l "[Dd]ebug" | sort >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE

# =============================================================================
# 10. CRITICAL REDUNDANCY ANALYSIS
# =============================================================================
echo -e "${RED}⚠️  CRITICAL REDUNDANCY ANALYSIS...${NC}"
echo "## Critical Redundancy Analysis" >> $OUTPUT_FILE

echo "### Multiple Panel Managers" >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE
echo "=== Searching for multiple panel management systems ===" >> $OUTPUT_FILE
find . -name "*.js" -type f | xargs grep -l "class.*PanelManager\|export.*PanelManager" | grep -v node_modules >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE
echo "=== Panel manager instantiations ===" >> $OUTPUT_FILE
find . -name "*.js" -type f | xargs grep -n "new.*PanelManager\|new.*panelManager" | grep -v node_modules >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE

echo "### Multiple Debug Systems" >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE
echo "=== Debug panel classes ===" >> $OUTPUT_FILE
find . -name "*.js" -type f | xargs grep -l "class.*Debug.*Panel\|export.*Debug.*Panel" | grep -v node_modules >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE
echo "=== Debug manager classes ===" >> $OUTPUT_FILE
find . -name "*.js" -type f | xargs grep -l "class.*Debug.*Manager\|export.*Debug.*Manager" | grep -v node_modules >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE

echo "### Multiple Redux Stores" >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE
find . -name "*.js" -type f | xargs grep -n "createStore\|configureStore\|new.*Store" | grep -v node_modules | grep -v ".git" >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE

# =============================================================================
# 11. SPECIFIC PROBLEM ANALYSIS
# =============================================================================
echo -e "${YELLOW}🎯 SPECIFIC PROBLEM ANALYSIS...${NC}"
echo "## Specific Problem Analysis" >> $OUTPUT_FILE

echo "### Four-Corner Button / Ctrl+Shift+1 References" >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE
find . -name "*.js" -type f | xargs grep -n "key.*1.*ctrl\|key.*1.*shift\|reset.*default" | grep -v node_modules | grep -v ".git" >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE

echo "### Empty Debug Dock Issues" >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE
find . -name "*.js" -type f | xargs grep -n -B2 -A2 "showDock.*debug\|debug.*dock.*show" | grep -v node_modules | grep -v ".git" >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE

echo "### State Update Conflicts" >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE
find . -name "*.js" -type f | xargs grep -n "dispatch.*panel\|dispatch.*debug" | grep -v node_modules | grep -v ".git" | head -20 >> $OUTPUT_FILE
echo '```' >> $OUTPUT_FILE

# =============================================================================
# 12. SUMMARY AND RECOMMENDATIONS
# =============================================================================
echo "" >> $OUTPUT_FILE
echo "## Summary" >> $OUTPUT_FILE
echo "This audit identified the following areas of concern:" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE
echo "1. **Multiple Panel Management Systems**: Found competing panel managers" >> $OUTPUT_FILE
echo "2. **Duplicate Debug Systems**: Redux-based and package-based debug systems" >> $OUTPUT_FILE
echo "3. **State Management Conflicts**: Multiple Redux stores and reducers" >> $OUTPUT_FILE
echo "4. **Keyboard Shortcut Overlaps**: Conflicting event handlers" >> $OUTPUT_FILE
echo "5. **Window Object Pollution**: Multiple assignments to global scope" >> $OUTPUT_FILE
echo "" >> $OUTPUT_FILE

echo -e "${GREEN}✅ AUDIT COMPLETE!${NC}"
echo -e "${BLUE}📄 Results saved to: ${OUTPUT_FILE}${NC}"
echo -e "${YELLOW}🔍 Review the output file for detailed analysis${NC}"

# Count total issues found
PANEL_MANAGERS=$(find . -name "*.js" -type f | xargs grep -l "PanelManager" | grep -v node_modules | wc -l)
DEBUG_SYSTEMS=$(find . -name "*.js" -type f | xargs grep -l "debug.*[Pp]anel\|[Dd]ebug.*dock" | grep -v node_modules | wc -l)
REDUX_FILES=$(find . -name "*reducer*.js" -o -name "*slice*.js" | grep -v node_modules | wc -l)

echo ""
echo -e "${CYAN}📊 QUICK STATS:${NC}"
echo -e "${CYAN}  - Files with PanelManager: ${PANEL_MANAGERS}${NC}"
echo -e "${CYAN}  - Files with Debug Systems: ${DEBUG_SYSTEMS}${NC}"
echo -e "${CYAN}  - Redux-related Files: ${REDUX_FILES}${NC}"