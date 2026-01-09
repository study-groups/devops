#!/bin/bash

# =================================================================
# RUN ALL WORKSPACE SIDEBAR SEARCHES
# =================================================================
# This master script runs all the specialized search scripts
# and creates a consolidated report
# =================================================================

echo "🚀 RUNNING ALL WORKSPACE SIDEBAR SYSTEM SEARCHES"
echo "================================================="
echo "This will run all specialized search scripts and create a consolidated report"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Create results directory
RESULTS_DIR="search-results-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$RESULTS_DIR"

echo -e "${CYAN}📁 Created results directory: $RESULTS_DIR${NC}"
echo ""

# Master report file
MASTER_REPORT="$RESULTS_DIR/MASTER_SEARCH_REPORT.md"
echo "# Workspace Sidebar System - Master Search Report" > $MASTER_REPORT
echo "Generated on: $(date)" >> $MASTER_REPORT
echo "" >> $MASTER_REPORT

# Function to run a search script and capture results
run_search_script() {
    local script_name="$1"
    local description="$2"
    
    echo -e "${YELLOW}🔍 Running: $script_name${NC}"
    echo "   $description"
    echo ""
    
    if [ -f "scripts/$script_name" ]; then
        echo "## $description" >> $MASTER_REPORT
        echo "Script: $script_name" >> $MASTER_REPORT
        echo "Run at: $(date)" >> $MASTER_REPORT
        echo "" >> $MASTER_REPORT
        
        # Run the script and capture its output
        cd scripts/
        bash "$script_name" > "../$RESULTS_DIR/${script_name%.sh}-output.txt" 2>&1
        cd ..
        
        # Move the results file created by the script
        if [ -f "${script_name%.sh}-search-results.md" ]; then
            mv "${script_name%.sh}-search-results.md" "$RESULTS_DIR/"
        fi
        
        # Check for other result files the script might have created
        for result_file in *-search-results.md *-results.md; do
            if [ -f "$result_file" ]; then
                mv "$result_file" "$RESULTS_DIR/" 2>/dev/null
            fi
        done
        
        echo -e "${GREEN}✅ Completed: $script_name${NC}"
        echo "   Results saved to: $RESULTS_DIR/"
        echo ""
        
        echo "### Results Summary" >> $MASTER_REPORT
        echo "- Output log: ${script_name%.sh}-output.txt" >> $MASTER_REPORT
        echo "- Detailed results: ${script_name%.sh}-search-results.md" >> $MASTER_REPORT
        echo "" >> $MASTER_REPORT
        
    else
        echo -e "${RED}❌ Script not found: scripts/$script_name${NC}"
        echo ""
        echo "### Error" >> $MASTER_REPORT
        echo "Script file not found: scripts/$script_name" >> $MASTER_REPORT
        echo "" >> $MASTER_REPORT
    fi
}

# =================================================================
# RUN ALL SEARCH SCRIPTS
# =================================================================

run_search_script "search-workspace-sidebar-system.sh" \
    "Comprehensive Workspace Sidebar System Search"

run_search_script "search-redux-state-tracking.sh" \
    "Redux State Tracking for Docks and Panels"

run_search_script "search-panel-components.sh" \
    "Panel Components Detailed Analysis"

run_search_script "search-dock-system.sh" \
    "Dock System Comprehensive Search"

run_search_script "search-sidebar-management.sh" \
    "Sidebar Management System Analysis"

# =================================================================
# CREATE CONSOLIDATED SUMMARY
# =================================================================

echo -e "${PURPLE}📊 Creating consolidated summary...${NC}"

echo "## Consolidated Search Summary" >> $MASTER_REPORT
echo "" >> $MASTER_REPORT

# Count total files analyzed
total_js_files=$(find . -name "*.js" | wc -l)
total_css_files=$(find . -name "*.css" | wc -l)
total_result_files=$(find "$RESULTS_DIR" -name "*-results.md" | wc -l)

echo "### Project Statistics" >> $MASTER_REPORT
echo "- Total JavaScript files in project: $total_js_files" >> $MASTER_REPORT
echo "- Total CSS files in project: $total_css_files" >> $MASTER_REPORT
echo "- Search result files generated: $total_result_files" >> $MASTER_REPORT
echo "" >> $MASTER_REPORT

# Create index of all result files
echo "### Generated Result Files" >> $MASTER_REPORT
echo "" >> $MASTER_REPORT
for file in "$RESULTS_DIR"/*.md; do
    if [ -f "$file" ] && [ "$(basename "$file")" != "MASTER_SEARCH_REPORT.md" ]; then
        echo "- $(basename "$file")" >> $MASTER_REPORT
    fi
done
echo "" >> $MASTER_REPORT

# Create quick navigation
echo "### Quick Navigation Guide" >> $MASTER_REPORT
echo "" >> $MASTER_REPORT
echo "1. **workspace-sidebar-system-search-results.md** - Overall system architecture" >> $MASTER_REPORT
echo "2. **redux-state-tracking-results.md** - Redux state management deep dive" >> $MASTER_REPORT
echo "3. **panel-components-search-results.md** - Individual panel implementations" >> $MASTER_REPORT
echo "4. **dock-system-search-results.md** - Dock system and fly-out capabilities" >> $MASTER_REPORT
echo "5. **sidebar-management-search-results.md** - Sidebar zone management" >> $MASTER_REPORT
echo "" >> $MASTER_REPORT

# Add key findings template
echo "### Key Findings (To be filled after analysis)" >> $MASTER_REPORT
echo "" >> $MASTER_REPORT
echo "#### WorkspaceManager Integration" >> $MASTER_REPORT
echo "- [ ] How WorkspaceManager controls the sidebar" >> $MASTER_REPORT
echo "- [ ] Semantic zone mapping for sidebar" >> $MASTER_REPORT
echo "- [ ] Dock placement and management" >> $MASTER_REPORT
echo "" >> $MASTER_REPORT
echo "#### Dock System" >> $MASTER_REPORT
echo "- [ ] Settings Dock implementation" >> $MASTER_REPORT
echo "- [ ] Controls Dock implementation" >> $MASTER_REPORT
echo "- [ ] Logs Dock implementation" >> $MASTER_REPORT
echo "- [ ] Single panel ownership mechanism" >> $MASTER_REPORT
echo "- [ ] Fly-out capabilities" >> $MASTER_REPORT
echo "" >> $MASTER_REPORT
echo "#### Panel System" >> $MASTER_REPORT
echo "- [ ] Panel registration system" >> $MASTER_REPORT
echo "- [ ] Settings panels (design-tokens, theme-selector, etc.)" >> $MASTER_REPORT
echo "- [ ] Panel state management" >> $MASTER_REPORT
echo "- [ ] Panel fly-out from docks" >> $MASTER_REPORT
echo "" >> $MASTER_REPORT
echo "#### Redux State Management" >> $MASTER_REPORT
echo "- [ ] Dock state structure" >> $MASTER_REPORT
echo "- [ ] Panel state structure" >> $MASTER_REPORT
echo "- [ ] Fly-out state tracking" >> $MASTER_REPORT
echo "- [ ] State persistence" >> $MASTER_REPORT
echo "" >> $MASTER_REPORT

# =================================================================
# CREATE ANALYSIS SCRIPT
# =================================================================

echo -e "${CYAN}📝 Creating analysis helper script...${NC}"

ANALYSIS_SCRIPT="$RESULTS_DIR/analyze-results.sh"
cat > "$ANALYSIS_SCRIPT" << 'EOF'
#!/bin/bash

# Helper script to analyze the search results
echo "🔍 WORKSPACE SIDEBAR SEARCH RESULTS ANALYSIS"
echo "============================================"
echo ""

echo "📁 Available result files:"
for file in *.md; do
    if [ -f "$file" ]; then
        lines=$(wc -l < "$file")
        size=$(du -h "$file" | cut -f1)
        echo "   📄 $file ($lines lines, $size)"
    fi
done
echo ""

echo "🔍 Quick analysis commands:"
echo "   View master report:     cat MASTER_SEARCH_REPORT.md"
echo "   Search all results:     grep -i 'PATTERN' *.md"
echo "   Count code matches:     grep -c '```' *.md"
echo "   Find specific files:    grep -h 'client/' *.md | sort | uniq"
echo ""

echo "📊 Summary statistics:"
total_lines=$(cat *.md | wc -l)
total_code_blocks=$(grep -c '```' *.md | awk -F: '{sum+=$2} END {print sum}')
echo "   Total lines in results: $total_lines"
echo "   Total code blocks found: $total_code_blocks"
echo ""

echo "💡 Suggested analysis workflow:"
echo "1. Read MASTER_SEARCH_REPORT.md for overview"
echo "2. Check workspace-sidebar-system-search-results.md for architecture"
echo "3. Review dock-system-search-results.md for dock implementations"
echo "4. Examine redux-state-tracking-results.md for state management"
echo "5. Look at panel-components-search-results.md for panel details"
echo "6. Check sidebar-management-search-results.md for sidebar specifics"
EOF

chmod +x "$ANALYSIS_SCRIPT"

# =================================================================
# FINAL SUMMARY
# =================================================================

echo -e "${PURPLE}🎯 ALL SEARCHES COMPLETE${NC}"
echo ""
echo -e "${GREEN}📂 Results Directory: $RESULTS_DIR${NC}"
echo ""
echo -e "${YELLOW}📋 Generated Files:${NC}"
ls -la "$RESULTS_DIR"
echo ""

echo -e "${CYAN}🔍 Next Steps:${NC}"
echo "1. cd $RESULTS_DIR"
echo "2. cat MASTER_SEARCH_REPORT.md"
echo "3. ./analyze-results.sh"
echo "4. Review individual result files as needed"
echo ""

echo -e "${GREEN}✅ Comprehensive workspace sidebar system search complete!${NC}"
echo -e "${GREEN}✅ Use the results to understand and refactor the dock/panel system${NC}"

# Add completion summary to master report
echo "" >> $MASTER_REPORT
echo "## Search Completion Summary" >> $MASTER_REPORT
echo "- All search scripts executed: $(date)" >> $MASTER_REPORT
echo "- Results directory: $RESULTS_DIR" >> $MASTER_REPORT
echo "- Use ./analyze-results.sh for interactive analysis" >> $MASTER_REPORT
echo "" >> $MASTER_REPORT
echo "---" >> $MASTER_REPORT
echo "*Generated by run-all-searches.sh*" >> $MASTER_REPORT