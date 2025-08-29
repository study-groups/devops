#!/bin/bash

# Panel CSS Architecture Audit Script
# Analyzes inline CSS in panels and existing CSS files for design token usage

echo "🎨 Panel CSS Architecture Audit"
echo "==============================="

BASE_DIR="/root/src/devops/devpages"
cd "$BASE_DIR"

OUTPUT_FILE="panel_css_audit.md"
echo "# Panel CSS Architecture Audit Report" > "$OUTPUT_FILE"
echo "Generated: $(date)" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Function to analyze inline CSS in JavaScript files
analyze_inline_css() {
    local file="$1"
    echo "## Analyzing: $file" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    
    # Look for style attributes and CSS-in-JS
    local inline_styles=$(grep -n "style.*=" "$file" 2>/dev/null | head -20)
    local css_strings=$(grep -n "\.style\." "$file" 2>/dev/null | head -10)
    local template_styles=$(grep -n "style.*:" "$file" 2>/dev/null | head -20)
    
    if [[ -n "$inline_styles" || -n "$css_strings" || -n "$template_styles" ]]; then
        echo "### Inline CSS Found:" >> "$OUTPUT_FILE"
        echo '```javascript' >> "$OUTPUT_FILE"
        
        if [[ -n "$inline_styles" ]]; then
            echo "// Style attributes:" >> "$OUTPUT_FILE"
            echo "$inline_styles" >> "$OUTPUT_FILE"
            echo "" >> "$OUTPUT_FILE"
        fi
        
        if [[ -n "$css_strings" ]]; then
            echo "// Direct style manipulation:" >> "$OUTPUT_FILE"
            echo "$css_strings" >> "$OUTPUT_FILE"
            echo "" >> "$OUTPUT_FILE"
        fi
        
        if [[ -n "$template_styles" ]]; then
            echo "// Template styles:" >> "$OUTPUT_FILE"
            echo "$template_styles" >> "$OUTPUT_FILE"
        fi
        
        echo '```' >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
        
        # Check for design token usage
        local design_tokens=$(grep -n "var(--" "$file" 2>/dev/null)
        if [[ -n "$design_tokens" ]]; then
            echo "### ✅ Design Tokens Used:" >> "$OUTPUT_FILE"
            echo '```css' >> "$OUTPUT_FILE"
            echo "$design_tokens" >> "$OUTPUT_FILE"
            echo '```' >> "$OUTPUT_FILE"
        else
            echo "### ❌ No Design Tokens Found" >> "$OUTPUT_FILE"
        fi
        echo "" >> "$OUTPUT_FILE"
        
        # Check for hardcoded values
        local hardcoded=$(grep -n -E "(#[0-9a-fA-F]{3,6}|rgb\(|rgba\(|[0-9]+px)" "$file" 2>/dev/null | head -10)
        if [[ -n "$hardcoded" ]]; then
            echo "### ⚠️ Hardcoded Values Found:" >> "$OUTPUT_FILE"
            echo '```css' >> "$OUTPUT_FILE"
            echo "$hardcoded" >> "$OUTPUT_FILE"
            echo '```' >> "$OUTPUT_FILE"
        fi
        echo "" >> "$OUTPUT_FILE"
    else
        echo "### ✅ No inline CSS found" >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
    fi
}

echo "🔍 Analyzing Panel Files for Inline CSS..."

# Analyze all panel JavaScript files
echo "# Panel JavaScript Files Analysis" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

panel_files=(
    "./client/panels/FileTreePanel.js"
    "./client/panels/CLIPanel.js"
    "./client/panels/CodePanel.js"
    "./client/panels/HtmlPanel.js"
    "./client/panels/JavaScriptPanel.js"
    "./client/panels/ContextPanel.js"
    "./client/panels/PreviewPanel.js"
    "./client/panels/EditorPanel.js"
    "./client/panels/BasePanel.js"
    "./packages/devpages-debug/panels/PDataPanel.js"
    "./packages/devpages-debug/panels/CssFilesPanel/CssFilesPanel.js"
    "./packages/devpages-debug/panels/ExternalDependenciesPanel.js"
    "./packages/devpages-debug/panels/JavaScriptInfoPanel.js"
    "./packages/devpages-debug/panels/dom-inspector/DomInspectorDebugPanel.js"
    "./packages/devpages-debug/DebugDock.js"
)

for file in "${panel_files[@]}"; do
    if [[ -f "$file" ]]; then
        analyze_inline_css "$file"
    fi
done

# Analyze existing panel CSS files
echo "# Existing Panel CSS Files" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo "🎨 Analyzing Existing Panel CSS Files..."

css_files=(
    "./client/panels/styles/BasePanel.css"
    "./client/panels/styles/EditorPanel.css"
    "./client/panels/styles/HtmlPanel.css"
    "./client/panels/styles/JavaScriptPanel.css"
    "./client/panels/styles/PreviewPanel.css"
    "./client/panels/PanelNavBar.css"
    "./client/styles/panel-flyout.css"
    "./client/styles/panel-reorder.css"
    "./client/styles/subpanel.css"
    "./packages/devpages-debug/debug-dock.css"
    "./packages/devpages-debug/panels/CssFilesPanel/css-files-panel.css"
)

for css_file in "${css_files[@]}"; do
    if [[ -f "$css_file" ]]; then
        echo "## CSS File: $css_file" >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
        
        # Check for design token usage
        local tokens=$(grep -n "var(--" "$css_file" 2>/dev/null)
        if [[ -n "$tokens" ]]; then
            echo "### ✅ Design Tokens Used:" >> "$OUTPUT_FILE"
            echo '```css' >> "$OUTPUT_FILE"
            echo "$tokens" >> "$OUTPUT_FILE"
            echo '```' >> "$OUTPUT_FILE"
        else
            echo "### ❌ No Design Tokens Found" >> "$OUTPUT_FILE"
        fi
        echo "" >> "$OUTPUT_FILE"
        
        # Check for hardcoded colors and sizes
        local hardcoded=$(grep -n -E "(#[0-9a-fA-F]{3,6}|rgb\(|rgba\()" "$css_file" 2>/dev/null)
        if [[ -n "$hardcoded" ]]; then
            echo "### ⚠️ Hardcoded Colors:" >> "$OUTPUT_FILE"
            echo '```css' >> "$OUTPUT_FILE"
            echo "$hardcoded" >> "$OUTPUT_FILE"
            echo '```' >> "$OUTPUT_FILE"
        fi
        echo "" >> "$OUTPUT_FILE"
    fi
done

# Analyze design token usage
echo "# Design Token Analysis" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo "🎯 Analyzing Design Token Usage..."

# Find all design token definitions
echo "## Available Design Tokens" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

design_files=(
    "./client/styles/design-system.css"
    "./client/styles/system.css"
    "./client/settings/panels/css-design/DesignTokensPanel.css"
)

for design_file in "${design_files[@]}"; do
    if [[ -f "$design_file" ]]; then
        echo "### From: $design_file" >> "$OUTPUT_FILE"
        local tokens=$(grep -n "^[[:space:]]*--" "$design_file" 2>/dev/null | head -20)
        if [[ -n "$tokens" ]]; then
            echo '```css' >> "$OUTPUT_FILE"
            echo "$tokens" >> "$OUTPUT_FILE"
            echo '```' >> "$OUTPUT_FILE"
        fi
        echo "" >> "$OUTPUT_FILE"
    fi
done

# Create recommendations
echo "# Recommendations" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo "## 1. Panel Container Semantics" >> "$OUTPUT_FILE"
echo "Create standardized panel container classes:" >> "$OUTPUT_FILE"
echo '```css' >> "$OUTPUT_FILE"
cat >> "$OUTPUT_FILE" << 'EOF'
/* Panel Container Base */
.panel-container {
  background: var(--panel-bg, var(--color-background, #ffffff));
  border: var(--panel-border, 1px solid var(--color-border, #e1e5e9));
  border-radius: var(--panel-border-radius, 4px);
  box-shadow: var(--panel-shadow, 0 2px 4px rgba(0,0,0,0.1));
}

/* Panel Header */
.panel-header {
  padding: var(--panel-header-padding, 8px 12px);
  border-bottom: var(--panel-header-border, 1px solid var(--color-border-light, #f0f0f0));
  background: var(--panel-header-bg, var(--color-background-secondary, #f8f9fa));
  font-size: var(--panel-header-font-size, 14px);
  font-weight: var(--panel-header-font-weight, 600);
}

/* Panel Content */
.panel-content {
  padding: var(--panel-content-padding, 12px);
  font-size: var(--panel-content-font-size, 12px);
  line-height: var(--panel-content-line-height, 1.4);
}

/* Panel Types */
.panel-container.debug-panel {
  --panel-bg: var(--debug-panel-bg, var(--color-background-tertiary, #fafafa));
  --panel-border: var(--debug-panel-border, 1px solid var(--color-border-debug, #dee2e6));
}

.panel-container.core-panel {
  --panel-bg: var(--core-panel-bg, var(--color-background, #ffffff));
  --panel-border: var(--core-panel-border, 1px solid var(--color-border, #e1e5e9));
}

.panel-container.settings-panel {
  --panel-bg: var(--settings-panel-bg, var(--color-background-secondary, #f8f9fa));
  --panel-border: var(--settings-panel-border, 1px solid var(--color-border-light, #f0f0f0));
}
EOF
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo "## 2. Typography Tokens" >> "$OUTPUT_FILE"
echo '```css' >> "$OUTPUT_FILE"
cat >> "$OUTPUT_FILE" << 'EOF'
/* Panel Typography */
:root {
  --panel-font-family: var(--font-family-base, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
  --panel-font-family-mono: var(--font-family-monospace, 'SF Mono', Monaco, 'Cascadia Code', monospace);
  
  --panel-text-primary: var(--color-text-primary, #212529);
  --panel-text-secondary: var(--color-text-secondary, #6c757d);
  --panel-text-muted: var(--color-text-muted, #adb5bd);
  
  --panel-font-size-xs: 10px;
  --panel-font-size-sm: 11px;
  --panel-font-size-base: 12px;
  --panel-font-size-lg: 14px;
  --panel-font-size-xl: 16px;
}
EOF
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo "## 3. Spacing and Layout Tokens" >> "$OUTPUT_FILE"
echo '```css' >> "$OUTPUT_FILE"
cat >> "$OUTPUT_FILE" << 'EOF'
/* Panel Spacing */
:root {
  --panel-spacing-xs: 4px;
  --panel-spacing-sm: 8px;
  --panel-spacing-base: 12px;
  --panel-spacing-lg: 16px;
  --panel-spacing-xl: 24px;
  
  --panel-border-radius-sm: 3px;
  --panel-border-radius-base: 4px;
  --panel-border-radius-lg: 6px;
}
EOF
echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo "## 4. Action Items" >> "$OUTPUT_FILE"
echo "1. **Create panel-specific CSS files** instead of inline styles" >> "$OUTPUT_FILE"
echo "2. **Implement design token system** for all panel styling" >> "$OUTPUT_FILE"
echo "3. **Standardize panel container markup** across all panels" >> "$OUTPUT_FILE"
echo "4. **Remove hardcoded colors and sizes** from inline styles" >> "$OUTPUT_FILE"
echo "5. **Create panel component library** with consistent styling" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo ""
echo "✅ Panel CSS audit complete!"
echo "📄 Report saved to: $OUTPUT_FILE"
echo ""
echo "Key findings:"
echo "- Inline CSS usage in panel files"
echo "- Design token adoption status"
echo "- Hardcoded values that need refactoring"
echo "- Recommendations for CSS architecture"
