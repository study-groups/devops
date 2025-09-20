#!/usr/bin/env bash

# Status Utilities - Standardized status display formatting for Tetra modules

# Format path relative to TETRA_DIR or TETRA_SRC for narrow display
_tetra_format_path() {
    local full_path="$1"
    local show_type="${2:-auto}"  # auto, full, relative, name

    if [[ -z "$full_path" ]]; then
        echo "<not set>"
        return
    fi

    case "$show_type" in
        full)
            echo "$full_path"
            ;;
        name)
            basename "$full_path"
            ;;
        relative)
            # Try TETRA_DIR first, then TETRA_SRC, then HOME
            if [[ -n "$TETRA_DIR" && "$full_path" == "$TETRA_DIR"* ]]; then
                echo "\$TETRA_DIR${full_path#$TETRA_DIR}"
            elif [[ -n "$TETRA_SRC" && "$full_path" == "$TETRA_SRC"* ]]; then
                echo "\$TETRA_SRC${full_path#$TETRA_SRC}"
            elif [[ "$full_path" == "$HOME"* ]]; then
                echo "~${full_path#$HOME}"
            else
                echo "$full_path"
            fi
            ;;
        auto|*)
            # Auto: relative if long, name if short
            local relative_path
            if [[ -n "$TETRA_DIR" && "$full_path" == "$TETRA_DIR"* ]]; then
                relative_path="\$TETRA_DIR${full_path#$TETRA_DIR}"
            elif [[ -n "$TETRA_SRC" && "$full_path" == "$TETRA_SRC"* ]]; then
                relative_path="\$TETRA_SRC${full_path#$TETRA_SRC}"
            else
                relative_path="$full_path"
            fi

            # Use relative if it's shorter than 60 chars, otherwise use basename
            if [[ ${#relative_path} -gt 60 ]]; then
                basename "$full_path"
            else
                echo "$relative_path"
            fi
            ;;
    esac
}

# Display environment header for status functions
_tetra_status_header() {
    local module_name="${1:-Tetra}"

    echo "${module_name} Status"
    echo "$(printf '=%.0s' $(seq 1 ${#module_name}))==========="
    echo "TETRA_DIR: ${TETRA_DIR:-<not set>}  TETRA_SRC: ${TETRA_SRC:-<not set>}"
    echo ""
}

# Format a status section header
_tetra_status_section() {
    local section_title="$1"
    local separator="${2:--}"

    echo "$section_title:"
    if [[ ${#section_title} -lt 40 ]]; then
        printf '%*s\n' ${#section_title} '' | tr ' ' "$separator"
    fi
}

# Format individual status items with consistent icons and alignment
_tetra_status_item() {
    local status="$1"      # success, warning, error, info, missing, disabled
    local label="$2"       # Item label
    local value="$3"       # Item value/path
    local format="${4:-auto}"  # auto, full, relative, name

    local icon
    case "$status" in
        success|ok|✓)     icon="✓" ;;
        warning|warn|⚠)  icon="⚠" ;;
        error|err|✗)     icon="✗" ;;
        info|ℹ)          icon="ℹ" ;;
        missing|○)        icon="○" ;;
        disabled|-)       icon="-" ;;
        *)                icon="·" ;;
    esac

    # Format the value based on type
    local formatted_value
    if [[ -d "$value" || -f "$value" ]]; then
        formatted_value="$(_tetra_format_path "$value" "$format")"
    else
        formatted_value="$value"
    fi

    printf "  %s %-20s %s\n" "$icon" "$label" "$formatted_value"
}

# Show directory structure status
_tetra_status_dirs() {
    local base_dir="$1"
    local required_dirs=("${@:2}")

    if [[ -z "$base_dir" ]]; then
        echo "  ✗ Base directory not set"
        return 1
    fi

    if [[ ! -d "$base_dir" ]]; then
        echo "  ✗ Base directory missing: $(_tetra_format_path "$base_dir")"
        return 1
    fi

    echo "  ✓ Base: $(_tetra_format_path "$base_dir")"

    for dir in "${required_dirs[@]}"; do
        local full_dir="$base_dir/$dir"
        if [[ -d "$full_dir" ]]; then
            _tetra_status_item "success" "$dir/" "$full_dir"
        else
            _tetra_status_item "missing" "$dir/" "$full_dir"
        fi
    done
}

# Show command availability status
_tetra_status_commands() {
    local commands=("$@")

    _tetra_status_section "Available Commands"
    for cmd in "${commands[@]}"; do
        if command -v "$cmd" >/dev/null 2>&1; then
            local cmd_path=$(command -v "$cmd")
            _tetra_status_item "success" "$cmd" "$cmd_path"
        else
            _tetra_status_item "missing" "$cmd" "not found"
        fi
    done
}

# Show module loading status
_tetra_status_modules() {
    local modules=("$@")

    _tetra_status_section "Module Status"
    for module in "${modules[@]}"; do
        if [[ "${TETRA_MODULE_LOADED[$module]:-false}" == "true" ]]; then
            local module_path="${TETRA_MODULE_LOADERS[$module]:-unknown}"
            _tetra_status_item "success" "$module" "$module_path"
        elif [[ -n "${TETRA_MODULE_LOADERS[$module]:-}" ]]; then
            _tetra_status_item "disabled" "$module" "registered but not loaded"
        else
            _tetra_status_item "missing" "$module" "not registered"
        fi
    done
}

# Show file counts in directories
_tetra_status_file_counts() {
    local base_dir="$1"
    shift
    local dirs=("$@")

    for dir in "${dirs[@]}"; do
        local full_dir="$base_dir/$dir"
        if [[ -d "$full_dir" ]]; then
            local count=$(find "$full_dir" -type f 2>/dev/null | wc -l | tr -d ' ')
            _tetra_status_item "info" "$dir files" "$count"
        else
            _tetra_status_item "missing" "$dir files" "0 (dir missing)"
        fi
    done
}

# Validate environment and show issues - only show problems
_tetra_status_validate_env() {
    local required_vars=("$@")
    local issues=0

    # Filter out meaningless metadata field names
    local filtered_vars=()
    for var in "${required_vars[@]}"; do
        if [[ ! "$var" =~ ^(category|commands|completions|description|status)$ ]]; then
            filtered_vars+=("$var")
        fi
    done

    # Only show if there are issues
    local problem_vars=()
    for var in "${filtered_vars[@]}"; do
        local value="${!var}"
        if [[ -z "$value" ]]; then
            problem_vars+=("$var: not set")
            ((issues++))
        elif [[ "$var" =~ _DIR$ ]] && [[ ! -d "$value" ]]; then
            problem_vars+=("$var: missing directory")
            ((issues++))
        fi
    done

    if [[ $issues -gt 0 ]]; then
        _tetra_status_section "Environment Issues"
        for problem in "${problem_vars[@]}"; do
            echo "  ✗ $problem"
        done
        echo ""
    fi

    return $issues
}

# Display module metadata if available
_tetra_status_metadata() {
    local module="$1"

    if ! command -v tetra_get_module_metadata >/dev/null 2>&1; then
        return 0
    fi

    local description=$(tetra_get_module_metadata "$module" "description" 2>/dev/null)
    local category=$(tetra_get_module_metadata "$module" "category" 2>/dev/null)
    local status=$(tetra_get_module_metadata "$module" "status" 2>/dev/null)

    if [[ -n "$description" ]]; then
        _tetra_status_section "Module Metadata"
        echo "  Description: $description"
        [[ -n "$category" ]] && echo "  Category: $category"
        [[ -n "$status" ]] && echo "  Status: $status"
        echo ""
    fi
}

# Show disk usage for module directories
_tetra_status_disk_usage() {
    local module_dir="$1"
    local show_details="${2:-false}"

    if [[ ! -d "$module_dir" ]]; then
        return 0
    fi

    _tetra_status_section "Storage Usage"

    # Total size
    local total_size=$(du -sh "$module_dir" 2>/dev/null | cut -f1)
    _tetra_status_item "info" "Total size" "$total_size"

    if [[ "$show_details" == "true" ]]; then
        # Subdirectory sizes
        while IFS= read -r line; do
            local size=$(echo "$line" | cut -f1)
            local dir=$(echo "$line" | cut -f2)
            local dir_name=$(basename "$dir")
            _tetra_status_item "info" "$dir_name/" "$size"
        done < <(du -sh "$module_dir"/*/ 2>/dev/null | sort -hr | head -5)
    fi
}

# Generic status function that can be used by any module
_tetra_status_generic() {
    local module_name="$1"
    local module_dir="$2"
    local required_commands=("${@:3}")

    _tetra_status_header "$module_name"

    # Environment validation
    _tetra_status_validate_env "TETRA_DIR" "TETRA_SRC"
    echo ""

    # Module metadata
    _tetra_status_metadata "$module_name"

    # Module directory structure
    if [[ -n "$module_dir" ]]; then
        _tetra_status_section "Module Directory"
        if [[ -d "$module_dir" ]]; then
            _tetra_status_item "success" "Location" "$module_dir"
            _tetra_status_dirs "$module_dir" "config" "logs" "cache"
        else
            _tetra_status_item "error" "Location" "$module_dir (missing)"
        fi
        echo ""
    fi

    # Command availability
    if [[ ${#required_commands[@]} -gt 0 ]]; then
        _tetra_status_commands "${required_commands[@]}"
        echo ""
    fi

    # Storage usage
    if [[ -d "$module_dir" ]]; then
        _tetra_status_disk_usage "$module_dir"
    fi
}

# Helper to show quick module status summary
_tetra_status_summary() {
    local modules=("$@")

    echo "Module Summary:"
    echo "==============="

    local loaded_count=0
    local total_count=${#modules[@]}

    for module in "${modules[@]}"; do
        if [[ "${TETRA_MODULE_LOADED[$module]:-false}" == "true" ]]; then
            echo "  ✓ $module"
            ((loaded_count++))
        else
            echo "  ○ $module"
        fi
    done

    echo ""
    echo "Loaded: $loaded_count/$total_count modules"
}