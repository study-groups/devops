#!/bin/bash

# Panel Inventory & Classification Script
# Creates detailed analysis of all panel types and their relationships

echo "🔍 Creating Panel System Inventory..."
echo "===================================="

BASE_DIR="/root/src/devops/devpages"
cd "$BASE_DIR"

OUTPUT_FILE="panel_inventory.json"
ANALYSIS_FILE="panel_analysis.md"

# Create JSON inventory
cat > "$OUTPUT_FILE" << 'EOF'
{
  "panelInventory": {
    "timestamp": "",
    "categories": {
      "core": {
        "description": "Essential application functionality panels",
        "manager": "client/layout/Sidebar.js",
        "panels": []
      },
      "debug": {
        "description": "Development and debugging tools",
        "manager": "packages/devpages-debug/DebugDock.js",
        "panels": []
      },
      "settings": {
        "description": "Configuration and preference panels",
        "manager": "client/settings/core/SettingsPanel.js",
        "panels": []
      },
      "utility": {
        "description": "Helper and tool panels",
        "manager": "various",
        "panels": []
      }
    },
    "managers": [],
    "registries": [],
    "conflicts": []
  }
}
EOF

# Update timestamp
sed -i "s/\"timestamp\": \"\"/\"timestamp\": \"$(date -Iseconds)\"/" "$OUTPUT_FILE"

echo "📊 Analyzing Panel Categories..."

# Function to analyze panel files
analyze_panel() {
    local file="$1"
    local category="$2"
    
    if [[ -f "$file" ]]; then
        local name=$(basename "$file" .js)
        local extends=$(grep -o "extends [A-Za-z]*" "$file" | head -1 | cut -d' ' -f2 || echo "none")
        local constructor=$(grep -c "constructor(" "$file" || echo "0")
        local render=$(grep -c "render(" "$file" || echo "0")
        local mount=$(grep -c "onMount\|mount" "$file" || echo "0")
        local store=$(grep -c "store\|redux" "$file" || echo "0")
        
        echo "    {
      \"name\": \"$name\",
      \"file\": \"$file\",
      \"extends\": \"$extends\",
      \"hasConstructor\": $constructor,
      \"hasRender\": $render,
      \"hasMount\": $mount,
      \"usesStore\": $store,
      \"category\": \"$category\"
    },"
    fi
}

# Start building the analysis
echo "# Panel System Analysis Report" > "$ANALYSIS_FILE"
echo "Generated: $(date)" >> "$ANALYSIS_FILE"
echo "" >> "$ANALYSIS_FILE"

# Core Panels Analysis
echo "## Core Application Panels" >> "$ANALYSIS_FILE"
echo "Managed by: \`client/layout/Sidebar.js\`" >> "$ANALYSIS_FILE"
echo "" >> "$ANALYSIS_FILE"

core_panels=(
    "./client/panels/FileTreePanel.js"
    "./client/panels/CLIPanel.js"
    "./client/panels/CodePanel.js"
    "./client/panels/HtmlPanel.js"
    "./client/panels/JavaScriptPanel.js"
    "./client/panels/ContextPanel.js"
    "./client/panels/PreviewPanel.js"
    "./client/panels/EditorPanel.js"
)

for panel in "${core_panels[@]}"; do
    if [[ -f "$panel" ]]; then
        name=$(basename "$panel" .js)
        echo "- **$name**: \`$panel\`" >> "$ANALYSIS_FILE"
        
        # Check what it extends
        extends=$(grep -o "extends [A-Za-z]*" "$panel" | head -1 | cut -d' ' -f2 2>/dev/null || echo "none")
        if [[ "$extends" != "none" ]]; then
            echo "  - Extends: $extends" >> "$ANALYSIS_FILE"
        fi
        
        # Check for key methods
        if grep -q "render(" "$panel"; then
            echo "  - Has render method" >> "$ANALYSIS_FILE"
        fi
        if grep -q "onMount\|mount" "$panel"; then
            echo "  - Has mount lifecycle" >> "$ANALYSIS_FILE"
        fi
        if grep -q "store\|redux" "$panel"; then
            echo "  - Uses Redux store" >> "$ANALYSIS_FILE"
        fi
        echo "" >> "$ANALYSIS_FILE"
    fi
done

# Debug Panels Analysis
echo "## Debug Panels" >> "$ANALYSIS_FILE"
echo "Managed by: \`packages/devpages-debug/DebugDock.js\`" >> "$ANALYSIS_FILE"
echo "" >> "$ANALYSIS_FILE"

debug_panels=(
    "./packages/devpages-debug/panels/PDataPanel.js"
    "./packages/devpages-debug/panels/CssFilesPanel/CssFilesPanel.js"
    "./packages/devpages-debug/panels/ExternalDependenciesPanel.js"
    "./packages/devpages-debug/panels/JavaScriptInfoPanel.js"
    "./packages/devpages-debug/devtools/DevToolsPanel.js"
)

for panel in "${debug_panels[@]}"; do
    if [[ -f "$panel" ]]; then
        name=$(basename "$panel" .js)
        echo "- **$name**: \`$panel\`" >> "$ANALYSIS_FILE"
        
        extends=$(grep -o "extends [A-Za-z]*" "$panel" | head -1 | cut -d' ' -f2 2>/dev/null || echo "none")
        if [[ "$extends" != "none" ]]; then
            echo "  - Extends: $extends" >> "$ANALYSIS_FILE"
        fi
        
        if grep -q "render(" "$panel"; then
            echo "  - Has render method" >> "$ANALYSIS_FILE"
        fi
        if grep -q "onMount\|mount" "$panel"; then
            echo "  - Has mount lifecycle" >> "$ANALYSIS_FILE"
        fi
        if grep -q "store\|redux" "$panel"; then
            echo "  - Uses Redux store" >> "$ANALYSIS_FILE"
        fi
        echo "" >> "$ANALYSIS_FILE"
    fi
done

# Settings Panels Analysis
echo "## Settings Panels" >> "$ANALYSIS_FILE"
echo "Managed by: \`client/settings/core/SettingsPanel.js\`" >> "$ANALYSIS_FILE"
echo "" >> "$ANALYSIS_FILE"

find ./client/settings/panels -name "*.js" -type f | while read panel; do
    if [[ -f "$panel" ]]; then
        name=$(basename "$panel" .js)
        echo "- **$name**: \`$panel\`" >> "$ANALYSIS_FILE"
        
        extends=$(grep -o "extends [A-Za-z]*" "$panel" | head -1 | cut -d' ' -f2 2>/dev/null || echo "none")
        if [[ "$extends" != "none" ]]; then
            echo "  - Extends: $extends" >> "$ANALYSIS_FILE"
        fi
        echo "" >> "$ANALYSIS_FILE"
    fi
done

# Panel Managers Analysis
echo "## Panel Management Systems" >> "$ANALYSIS_FILE"
echo "" >> "$ANALYSIS_FILE"

managers=(
    "./client/layout/Sidebar.js:General app panels"
    "./packages/devpages-debug/DebugDock.js:Debug panels"
    "./client/panels/PanelStateManager.js:Panel state persistence"
    "./client/panels/PanelControlCenter.js:Panel coordination"
    "./client/layout/WorkspaceManager.js:Workspace layout"
)

for manager_info in "${managers[@]}"; do
    IFS=':' read -r file description <<< "$manager_info"
    if [[ -f "$file" ]]; then
        echo "- **$(basename "$file" .js)**: $description" >> "$ANALYSIS_FILE"
        echo "  - File: \`$file\`" >> "$ANALYSIS_FILE"
        
        # Count methods
        methods=$(grep -c "^\s*[a-zA-Z_][a-zA-Z0-9_]*\s*(" "$file" 2>/dev/null || echo "0")
        echo "  - Methods: $methods" >> "$ANALYSIS_FILE"
        
        # Check for panel-related functionality
        if grep -q "registerPanel\|createPanel" "$file"; then
            echo "  - Has panel registration" >> "$ANALYSIS_FILE"
        fi
        if grep -q "render.*panel\|panel.*render" "$file"; then
            echo "  - Handles panel rendering" >> "$ANALYSIS_FILE"
        fi
        echo "" >> "$ANALYSIS_FILE"
    fi
done

# Registry Systems Analysis
echo "## Panel Registry Systems" >> "$ANALYSIS_FILE"
echo "" >> "$ANALYSIS_FILE"

registries=(
    "./client/panels/panelRegistry.js"
    "./client/panels/panelConfiguration.js"
    "./client/settings/core/settingsRegistry.js"
)

for registry in "${registries[@]}"; do
    if [[ -f "$registry" ]]; then
        name=$(basename "$registry" .js)
        echo "- **$name**: \`$registry\`" >> "$ANALYSIS_FILE"
        
        # Count registered items
        registered=$(grep -c "register\|add.*panel" "$registry" 2>/dev/null || echo "0")
        echo "  - Registration calls: $registered" >> "$ANALYSIS_FILE"
        echo "" >> "$ANALYSIS_FILE"
    fi
done

# Conflicts and Issues Analysis
echo "## Identified Issues & Conflicts" >> "$ANALYSIS_FILE"
echo "" >> "$ANALYSIS_FILE"

echo "### Multiple Panel Managers" >> "$ANALYSIS_FILE"
echo "- Sidebar.js manages core app panels" >> "$ANALYSIS_FILE"
echo "- DebugDock.js manages debug panels separately" >> "$ANALYSIS_FILE"
echo "- Settings panels have their own initialization" >> "$ANALYSIS_FILE"
echo "" >> "$ANALYSIS_FILE"

echo "### Inconsistent Interfaces" >> "$ANALYSIS_FILE"
echo "- Some panels extend BasePanel, others don't" >> "$ANALYSIS_FILE"
echo "- Different constructor patterns" >> "$ANALYSIS_FILE"
echo "- Inconsistent lifecycle methods" >> "$ANALYSIS_FILE"
echo "" >> "$ANALYSIS_FILE"

echo "### Registration Conflicts" >> "$ANALYSIS_FILE"
echo "- Multiple registration systems" >> "$ANALYSIS_FILE"
echo "- No unified panel discovery" >> "$ANALYSIS_FILE"
echo "- Potential ID conflicts" >> "$ANALYSIS_FILE"
echo "" >> "$ANALYSIS_FILE"

# Summary Statistics
echo "## Summary Statistics" >> "$ANALYSIS_FILE"
echo "" >> "$ANALYSIS_FILE"

total_panels=$(find . -name "*Panel.js" -type f | grep -v node_modules | wc -l)
core_count=$(echo "${core_panels[@]}" | wc -w)
debug_count=$(echo "${debug_panels[@]}" | wc -w)
settings_count=$(find ./client/settings/panels -name "*.js" -type f | wc -l)

echo "- **Total Panel Files**: $total_panels" >> "$ANALYSIS_FILE"
echo "- **Core Panels**: $core_count" >> "$ANALYSIS_FILE"
echo "- **Debug Panels**: $debug_count" >> "$ANALYSIS_FILE"
echo "- **Settings Panels**: $settings_count" >> "$ANALYSIS_FILE"
echo "- **Panel Managers**: 5+" >> "$ANALYSIS_FILE"
echo "- **Registry Systems**: 3+" >> "$ANALYSIS_FILE"

echo ""
echo "✅ Panel inventory complete!"
echo "📄 Analysis saved to: $ANALYSIS_FILE"
echo "📊 JSON data saved to: $OUTPUT_FILE"
echo ""
echo "Next steps:"
echo "1. Review the analysis file: cat $ANALYSIS_FILE"
echo "2. Plan the consolidation strategy"
echo "3. Begin with debug panel migration"
