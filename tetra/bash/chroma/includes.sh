#!/usr/bin/env bash

# Chroma Module - Terminal Markdown Viewer

# Load module utilities
source "$TETRA_SRC/bash/utils/module_init.sh"
source "$TETRA_SRC/bash/utils/function_helpers.sh"

# Initialize module with standard tetra conventions
tetra_module_init_with_alias "chroma" "CHROMA"

#==============================================================================
# DEPENDENCY DECLARATION
#==============================================================================

# Declare module dependencies
declare -gA CHROMA_DEPENDENCIES=(
    [tds]="required"
)

# Check dependencies
chroma_check_dependencies() {
    local missing_deps=()

    for dep in "${!CHROMA_DEPENDENCIES[@]}"; do
        local dep_type="${CHROMA_DEPENDENCIES[$dep]}"

        if [[ "$dep_type" == "required" ]]; then
            # Check if TDS functions are actually loaded
            case "$dep" in
                tds)
                    tetra_function_exists tds_markdown || missing_deps+=("$dep")
                    ;;
                *)
                    [[ -z "${!dep}" ]] && missing_deps+=("$dep")
                    ;;
            esac
        fi
    done

    if (( ${#missing_deps[@]} > 0 )); then
        echo "Error: Missing required dependencies: ${missing_deps[*]}" >&2
        echo "Chroma requires TDS module to be loaded first" >&2
        return 1
    fi

    return 0
}

#==============================================================================
# DEPENDENCY LOADING
#==============================================================================

# Load TDS module first (chroma depends on it)
if ! chroma_check_dependencies 2>/dev/null; then
    # Try tetra module system first, fall back to direct source
    if tetra_function_exists tetra_load_module; then
        tetra_load_module "tds" || {
            echo "Error: Failed to load TDS module (required by chroma)" >&2
            return 1
        }
    else
        # Direct source when not in tetra module system
        local tds_path="${TDS_SRC:-$TETRA_SRC/bash/tds}/includes.sh"
        if [[ -f "$tds_path" ]]; then
            source "$tds_path" || {
                echo "Error: Failed to source TDS from $tds_path" >&2
                return 1
            }
        else
            echo "Error: TDS module not found at $tds_path" >&2
            return 1
        fi
    fi
fi

# Verify dependencies are met after loading
chroma_check_dependencies || return 1

#==============================================================================
# LOAD CHROMA CORE
#==============================================================================

# 1. Core modules
source "$CHROMA_SRC/core/parser_registry.sh"
source "$CHROMA_SRC/core/cst.sh"
source "$CHROMA_SRC/core/table_render.sh"
source "$CHROMA_SRC/core/code_highlight.sh"

# 2. Built-in parsers (self-register on load)
for _chroma_parser in "$CHROMA_SRC/parsers"/*.sh; do
    [[ -f "$_chroma_parser" ]] && source "$_chroma_parser"
done
unset _chroma_parser

# 3. Doctor (health checks)
source "$CHROMA_SRC/doctor.sh"

# 4. Main chroma command
source "$CHROMA_SRC/chroma.sh"

# 5. Tab completion
source "$CHROMA_SRC/chroma_complete.sh"

#==============================================================================
# RELOAD SUPPORT
#==============================================================================

# Reload chroma module (for development)
chroma_reload() {
    echo "Reloading chroma..."

    # Clear parser registry
    CHROMA_PARSERS=()
    CHROMA_PARSER_META=()
    CHROMA_EXT_MAP=()
    CHROMA_PARSER_ORDER=()

    # Re-source all components
    source "$CHROMA_SRC/core/parser_registry.sh"
    source "$CHROMA_SRC/core/cst.sh"
    source "$CHROMA_SRC/core/table_render.sh"

    for _chroma_parser in "$CHROMA_SRC/parsers"/*.sh; do
        [[ -f "$_chroma_parser" ]] && source "$_chroma_parser"
    done
    unset _chroma_parser

    source "$CHROMA_SRC/doctor.sh"
    source "$CHROMA_SRC/chroma.sh"

    echo "Reloaded: ${#CHROMA_PARSER_ORDER[@]} parsers"
    chroma_status
}

export -f chroma_reload
