#!/bin/bash

# Panel CSS Refactoring Script
# Converts inline CSS to design token classes across all panels

echo "🎨 Starting Panel CSS Refactoring..."
echo "===================================="

BASE_DIR="/root/src/devops/devpages"
cd "$BASE_DIR"

# Create backup directory
BACKUP_DIR="panel_css_backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "📁 Creating backups in: $BACKUP_DIR"

# Function to backup and refactor a file
refactor_panel() {
    local file="$1"
    local panel_type="$2"
    
    if [[ ! -f "$file" ]]; then
        echo "⚠️  File not found: $file"
        return
    fi
    
    echo "🔧 Refactoring: $file"
    
    # Create backup
    cp "$file" "$BACKUP_DIR/$(basename "$file").backup"
    
    # Create temporary file for refactoring
    local temp_file="${file}.tmp"
    cp "$file" "$temp_file"
    
    # Common inline style patterns to replace with classes
    
    # Replace common padding patterns
    sed -i 's/style="padding: 12px;"/class="panel-content"/g' "$temp_file"
    sed -i 's/style="padding: 8px 12px;"/class="panel-header"/g' "$temp_file"
    sed -i 's/style="padding: 4px 8px;"/class="panel-p-sm"/g' "$temp_file"
    sed -i 's/style="padding: 16px;"/class="panel-p-lg"/g' "$temp_file"
    
    # Replace margin patterns
    sed -i 's/style="margin-bottom: 16px;"/class="panel-mb-lg"/g' "$temp_file"
    sed -i 's/style="margin-bottom: 12px;"/class="panel-mb-base"/g' "$temp_file"
    sed -i 's/style="margin-bottom: 8px;"/class="panel-mb-sm"/g' "$temp_file"
    sed -i 's/style="margin-bottom: 4px;"/class="panel-mb-xs"/g' "$temp_file"
    
    # Replace font-size patterns
    sed -i 's/font-size: 14px;/font-size: var(--panel-font-size-lg);/g' "$temp_file"
    sed -i 's/font-size: 12px;/font-size: var(--panel-font-size-base);/g' "$temp_file"
    sed -i 's/font-size: 11px;/font-size: var(--panel-font-size-sm);/g' "$temp_file"
    sed -i 's/font-size: 10px;/font-size: var(--panel-font-size-xs);/g' "$temp_file"
    
    # Replace color patterns
    sed -i 's/color: #212529;/color: var(--panel-text-primary);/g' "$temp_file"
    sed -i 's/color: #6c757d;/color: var(--panel-text-secondary);/g' "$temp_file"
    sed -i 's/color: #666;/color: var(--panel-text-muted);/g' "$temp_file"
    
    # Replace background patterns
    sed -i 's/background: #f8f9fa;/background: var(--color-background-secondary);/g' "$temp_file"
    sed -i 's/background: white;/background: var(--color-background);/g' "$temp_file"
    sed -i 's/background: #ffffff;/background: var(--color-background);/g' "$temp_file"
    
    # Replace border patterns
    sed -i 's/border: 1px solid #e1e5e9;/border: var(--panel-border);/g' "$temp_file"
    sed -i 's/border-radius: 4px;/border-radius: var(--panel-border-radius);/g' "$temp_file"
    sed -i 's/border-radius: 3px;/border-radius: var(--panel-border-radius-sm);/g' "$temp_file"
    
    # Replace button patterns
    sed -i 's/background: var(--color-primary, #007bff); color: white; border: none; border-radius: 4px; cursor: pointer;/class="panel-button primary"/g' "$temp_file"
    sed -i 's/background: var(--color-secondary, #6c757d); color: white; border: none; border-radius: 4px; cursor: pointer;/class="panel-button secondary"/g' "$temp_file"
    
    # Add panel container class based on type
    case "$panel_type" in
        "debug")
            sed -i 's/class="/class="panel-container debug-panel /g' "$temp_file"
            ;;
        "core")
            sed -i 's/class="/class="panel-container core-panel /g' "$temp_file"
            ;;
        "settings")
            sed -i 's/class="/class="panel-container settings-panel /g' "$temp_file"
            ;;
    esac
    
    # Move temp file to original
    mv "$temp_file" "$file"
    
    echo "✅ Refactored: $file"
}

# Refactor debug panels
echo ""
echo "🐛 Refactoring Debug Panels..."
refactor_panel "./packages/devpages-debug/panels/JavaScriptInfoPanel.js" "debug"
refactor_panel "./packages/devpages-debug/panels/ExternalDependenciesPanel.js" "debug"
refactor_panel "./packages/devpages-debug/panels/dom-inspector/DomInspectorDebugPanel.js" "debug"
refactor_panel "./packages/devpages-debug/panels/PDataPanel.js" "debug"

# Refactor core panels
echo ""
echo "🏠 Refactoring Core Panels..."
refactor_panel "./client/panels/FileTreePanel.js" "core"
refactor_panel "./client/panels/CLIPanel.js" "core"
refactor_panel "./client/panels/CodePanel.js" "core"
refactor_panel "./client/panels/HtmlPanel.js" "core"
refactor_panel "./client/panels/JavaScriptPanel.js" "core"
refactor_panel "./client/panels/PreviewPanel.js" "core"
refactor_panel "./client/panels/EditorPanel.js" "core"

# Create updated CSS imports
echo ""
echo "📦 Creating CSS Import File..."

cat > "./client/styles/panels/index.css" << 'EOF'
/**
 * Panel System CSS Imports
 * Import this file to get all panel styling
 */

@import './panel-system.css';

/* Import existing panel CSS files and update them */
@import '../panel-flyout.css';
@import '../panel-reorder.css';
@import '../subpanel.css';
@import '../../panels/styles/BasePanel.css';
@import '../../panels/PanelNavBar.css';
EOF

# Create a summary report
echo ""
echo "📊 Creating Refactoring Summary..."

cat > "panel_css_refactoring_summary.md" << 'EOF'
# Panel CSS Refactoring Summary

## Changes Made

### 1. Created Unified Panel CSS System
- `client/styles/panels/panel-system.css` - Complete design token system
- `client/styles/panels/index.css` - Import file for all panel styles

### 2. Refactored Inline CSS
- Replaced hardcoded values with design tokens
- Standardized padding, margins, font-sizes
- Unified color usage across panels
- Converted inline styles to CSS classes

### 3. Panel Type Classification
- Debug panels: `.panel-container.debug-panel`
- Core panels: `.panel-container.core-panel`  
- Settings panels: `.panel-container.settings-panel`

### 4. Design Token Categories
- **Container**: `--panel-bg`, `--panel-border`, `--panel-border-radius`
- **Typography**: `--panel-font-size-*`, `--panel-text-*`
- **Spacing**: `--panel-spacing-*`, `--panel-*-padding`
- **Colors**: `--panel-text-primary/secondary/muted`
- **Components**: Button, form, list, stat utilities

## Next Steps

1. **Import the new CSS system** in your main CSS file:
   ```css
   @import './client/styles/panels/index.css';
   ```

2. **Update panel templates** to use new classes:
   ```html
   <!-- Old -->
   <div style="padding: 12px; font-size: 12px;">
   
   <!-- New -->
   <div class="panel-content">
   ```

3. **Test all panels** to ensure styling is consistent

4. **Remove remaining inline styles** gradually

## Benefits

- ✅ Consistent design across all panels
- ✅ Easy theme customization via design tokens
- ✅ Responsive design built-in
- ✅ Maintainable CSS architecture
- ✅ Better performance (no inline styles)
EOF

echo ""
echo "✅ Panel CSS Refactoring Complete!"
echo ""
echo "📄 Summary report: panel_css_refactoring_summary.md"
echo "💾 Backups saved in: $BACKUP_DIR"
echo ""
echo "🚀 Next Steps:"
echo "1. Import the new CSS system in your main CSS file"
echo "2. Test all panels for consistent styling"
echo "3. Gradually remove remaining inline styles"
echo "4. Customize design tokens as needed"
