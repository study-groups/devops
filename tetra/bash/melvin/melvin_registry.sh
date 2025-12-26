#!/usr/bin/env bash

# MELVIN Registry - Tetra Module Enhancement
# Populates TETRA_MODULE_META with rich metadata from classification

# Declare the enhancement array (Tetra may or may not have it)
declare -gA TETRA_MODULE_META 2>/dev/null || true

# Generate metadata for a single module
# Usage: melvin_generate_module_meta <module_name> <module_path>
# Returns: Pipe-delimited metadata string
melvin_generate_module_meta() {
    local name="$1"
    local path="$2"

    [[ ! -d "$path" ]] && return 1

    # Get classification (uses melvin_classify.sh functions)
    melvin_detect_module_type "$path" >/dev/null 2>&1
    local type="${MELVIN_CLASS_TYPE[$name]:-UNKNOWN}"
    local features="${MELVIN_CLASS_FEATURES[$name]:-}"

    # Count files and lines
    local file_count=$(find "$path" -maxdepth 2 -name "*.sh" -type f 2>/dev/null | wc -l | tr -d ' ')
    local line_count=$(find "$path" -maxdepth 2 -name "*.sh" -type f -exec cat {} \; 2>/dev/null | wc -l | tr -d ' ')

    # Check for docs/tests
    local has_readme=0
    local has_tests=0
    [[ -f "$path/README.md" ]] && has_readme=1
    [[ -d "$path/tests" ]] && has_tests=1

    # Serialize (pipe-delimited key:value pairs)
    echo "type:${type}|features:${features// /,}|files:${file_count}|lines:${line_count}|has_readme:${has_readme}|has_tests:${has_tests}"
}

# Parse a field from metadata string
# Usage: melvin_parse_meta <meta_string> <field>
melvin_parse_meta() {
    local meta="$1"
    local field="$2"

    echo "$meta" | tr '|' '\n' | grep "^${field}:" | cut -d: -f2
}

# Enhance Tetra's registry with MELVIN metadata
# Usage: melvin_enhance_tetra_registry [--save] [--cached]
melvin_enhance_tetra_registry() {
    local save_flag=0
    local cached_flag=0

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --save|-s) save_flag=1; shift ;;
            --cached|-c) cached_flag=1; shift ;;
            *) shift ;;
        esac
    done

    # If cached, try to load from snapshot
    if [[ $cached_flag -eq 1 ]]; then
        local cached=$(melvin_db_load_snapshot "registry" 2>/dev/null)
        if [[ -n "$cached" ]]; then
            echo "Loading from cache..."
            _melvin_parse_registry_cache "$cached"
            return 0
        fi
        echo "No cache found, scanning..."
    fi

    # Check if Tetra arrays exist
    if [[ -z "${TETRA_MODULES[*]+set}" ]]; then
        echo "Warning: TETRA_MODULES not available - scanning $MELVIN_ROOT" >&2
        # Fall back to MELVIN's own scan
        melvin_classify_all >/dev/null 2>&1
        _melvin_enhance_from_classify "$save_flag"
        return $?
    fi

    # Clear and populate from Tetra
    TETRA_MODULE_META=()

    local json_output="{"
    local first=1
    local count=0

    for name in "${TETRA_MODULE_LIST[@]}"; do
        local path="${TETRA_MODULES[$name]}"
        local meta=$(melvin_generate_module_meta "$name" "$path")

        TETRA_MODULE_META["$name"]="$meta"

        # Build JSON for saving
        if [[ $first -eq 1 ]]; then
            first=0
        else
            json_output+=","
        fi
        # Escape path for JSON
        local escaped_path="${path//\"/\\\"}"
        json_output+="\"$name\":{\"meta\":\"$meta\",\"path\":\"$escaped_path\"}"
        ((count++))
    done

    json_output+="}"

    echo "Enhanced $count modules"

    # Save if requested
    if [[ $save_flag -eq 1 ]]; then
        melvin_db_save_snapshot "registry" "$json_output"
    fi
}

# Enhance from MELVIN's own classification (when Tetra not loaded)
_melvin_enhance_from_classify() {
    local save_flag="$1"

    TETRA_MODULE_META=()

    local json_output="{"
    local first=1
    local count=0

    for name in "${!MELVIN_CLASS_TYPE[@]}"; do
        local type="${MELVIN_CLASS_TYPE[$name]}"
        local features="${MELVIN_CLASS_FEATURES[$name]:-}"

        # Build metadata
        local meta="type:${type}|features:${features// /,}"
        TETRA_MODULE_META["$name"]="$meta"

        if [[ $first -eq 1 ]]; then
            first=0
        else
            json_output+=","
        fi
        json_output+="\"$name\":{\"meta\":\"$meta\"}"
        ((count++))
    done

    json_output+="}"

    echo "Enhanced $count modules (from MELVIN scan)"

    if [[ $save_flag -eq 1 ]]; then
        melvin_db_save_snapshot "registry" "$json_output"
    fi
}

# Parse registry cache back into TETRA_MODULE_META
_melvin_parse_registry_cache() {
    local json="$1"

    TETRA_MODULE_META=()

    # Simple parsing with jq if available
    if command -v jq >/dev/null 2>&1; then
        local modules=$(echo "$json" | jq -r 'keys[]' 2>/dev/null)
        local count=0
        for module in $modules; do
            local meta=$(echo "$json" | jq -r ".\"$module\".meta" 2>/dev/null)
            [[ -n "$meta" && "$meta" != "null" ]] && {
                TETRA_MODULE_META["$module"]="$meta"
                ((count++))
            }
        done
        echo "Loaded $count modules from cache"
    else
        echo "Warning: jq not available for cache parsing" >&2
        return 1
    fi
}

# Show registry info
# Usage: melvin_show_registry [module_name]
melvin_show_registry() {
    local module="$1"

    if [[ -z "${TETRA_MODULE_META[*]+set}" ]] || [[ ${#TETRA_MODULE_META[@]} -eq 0 ]]; then
        echo "Registry not enhanced. Run: melvin enhance"
        return 1
    fi

    if [[ -n "$module" ]]; then
        # Show specific module
        local meta="${TETRA_MODULE_META[$module]}"
        if [[ -z "$meta" ]]; then
            echo "Module not found: $module"
            return 1
        fi

        echo "Module: $module"
        if [[ -n "${TETRA_MODULES[$module]+set}" ]]; then
            echo "Path: ${TETRA_MODULES[$module]}"
        fi
        echo ""
        echo "Metadata:"
        echo "$meta" | tr '|' '\n' | while IFS=: read -r key val; do
            printf "  %-12s %s\n" "$key:" "$val"
        done
    else
        # Show all
        echo "TETRA Module Registry (Enhanced)"
        echo "================================="
        echo ""
        printf "%-15s %-12s %-25s %5s %6s\n" "MODULE" "TYPE" "FEATURES" "FILES" "LINES"
        printf "%-15s %-12s %-25s %5s %6s\n" "───────────────" "────────────" "─────────────────────────" "─────" "──────"

        for name in $(printf '%s\n' "${!TETRA_MODULE_META[@]}" | sort); do
            local meta="${TETRA_MODULE_META[$name]}"
            local type=$(melvin_parse_meta "$meta" "type")
            local features=$(melvin_parse_meta "$meta" "features")
            local files=$(melvin_parse_meta "$meta" "files")
            local lines=$(melvin_parse_meta "$meta" "lines")

            printf "%-15s %-12s %-25s %5s %6s\n" "$name" "$type" "${features:0:25}" "${files:-?}" "${lines:-?}"
        done

        echo ""
        echo "Total: ${#TETRA_MODULE_META[@]} modules"
    fi
}

# Export functions
export -f melvin_generate_module_meta
export -f melvin_parse_meta
export -f melvin_enhance_tetra_registry
export -f melvin_show_registry
