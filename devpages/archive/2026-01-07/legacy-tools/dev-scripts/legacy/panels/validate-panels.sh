#!/bin/bash

# Panel System Validation Script
# Validates panel YAML configurations and relationships

echo "🔍 PANEL SYSTEM VALIDATION"
echo "=========================="

PANELS_DIR="/root/src/devops/devpages/client/panels"
ERRORS=0

# Function to validate YAML syntax
validate_yaml() {
    local file="$1"
    if command -v yq >/dev/null 2>&1; then
        if ! yq eval '.' "$file" >/dev/null 2>&1; then
            echo "❌ Invalid YAML syntax: $file"
            ((ERRORS++))
            return 1
        fi
    else
        echo "⚠️  yq not available, skipping YAML syntax validation"
    fi
    return 0
}

# Function to validate required fields
validate_required_fields() {
    local file="$1"
    local required_fields=("panel.id" "panel.name" "panel.tags" "panel.component.path")
    
    for field in "${required_fields[@]}"; do
        if command -v yq >/dev/null 2>&1; then
            if ! yq eval ".$field" "$file" >/dev/null 2>&1 || [ "$(yq eval ".$field" "$file")" = "null" ]; then
                echo "❌ Missing required field '$field' in: $file"
                ((ERRORS++))
            fi
        fi
    done
}

# Function to validate panel relationships
validate_relationships() {
    echo "🔍 Validating panel relationships..."
    
    # Collect all panel IDs
    declare -A panel_ids
    while IFS= read -r -d '' file; do
        if command -v yq >/dev/null 2>&1; then
            id=$(yq eval '.panel.id' "$file" 2>/dev/null)
            if [ "$id" != "null" ] && [ -n "$id" ]; then
                panel_ids["$id"]="$file"
            fi
        fi
    done < <(find "$PANELS_DIR" -name "*.yaml" -print0)
    
    # Check parent/child relationships
    while IFS= read -r -d '' file; do
        if command -v yq >/dev/null 2>&1; then
            # Check parents exist
            parents=$(yq eval '.panel.parents[]?' "$file" 2>/dev/null)
            if [ -n "$parents" ]; then
                while IFS= read -r parent; do
                    if [ -n "$parent" ] && [ ! "${panel_ids[$parent]+_}" ]; then
                        echo "❌ Parent panel '$parent' not found (referenced in: $file)"
                        ((ERRORS++))
                    fi
                done <<< "$parents"
            fi
            
            # Check children exist
            children=$(yq eval '.panel.children[]?' "$file" 2>/dev/null)
            if [ -n "$children" ]; then
                while IFS= read -r child; do
                    if [ -n "$child" ] && [ ! "${panel_ids[$child]+_}" ]; then
                        echo "❌ Child panel '$child' not found (referenced in: $file)"
                        ((ERRORS++))
                    fi
                done <<< "$children"
            fi
        fi
    done < <(find "$PANELS_DIR" -name "*.yaml" -print0)
}

# Function to validate component paths
validate_component_paths() {
    echo "🔍 Validating component paths..."
    
    while IFS= read -r -d '' file; do
        if command -v yq >/dev/null 2>&1; then
            component_path=$(yq eval '.panel.component.path' "$file" 2>/dev/null)
            if [ "$component_path" != "null" ] && [ -n "$component_path" ]; then
                # Convert relative path to absolute
                if [[ "$component_path" == ./* ]]; then
                    full_path="$PANELS_DIR/${component_path#./}"
                else
                    full_path="$component_path"
                fi
                
                if [ ! -f "$full_path" ]; then
                    echo "⚠️  Component file not found: $component_path (in: $file)"
                fi
            fi
        fi
    done < <(find "$PANELS_DIR" -name "*.yaml" -print0)
}

# Main validation
echo "📁 Scanning panels directory: $PANELS_DIR"

if [ ! -d "$PANELS_DIR" ]; then
    echo "❌ Panels directory not found: $PANELS_DIR"
    exit 1
fi

# Find and validate all panel YAML files
panel_count=0
while IFS= read -r -d '' file; do
    echo "🔍 Validating: $file"
    validate_yaml "$file"
    validate_required_fields "$file"
    ((panel_count++))
done < <(find "$PANELS_DIR" -name "*.yaml" -print0)

echo ""
echo "📊 VALIDATION SUMMARY"
echo "===================="
echo "Panels found: $panel_count"

if [ $panel_count -gt 0 ]; then
    validate_relationships
    validate_component_paths
fi

echo ""
if [ $ERRORS -eq 0 ]; then
    echo "✅ All panels valid!"
    exit 0
else
    echo "❌ Found $ERRORS validation errors"
    exit 1
fi
