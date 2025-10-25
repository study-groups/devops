#!/usr/bin/env bash

# MELVIN Scanner - Code Parser and Knowledge Extractor
# Parses modules to extract detailed information

# Strong globals
: "${MELVIN_SRC:=$TETRA_SRC/bash/melvin}"
: "${MELVIN_DIR:=$TETRA_DIR/melvin}"

# Knowledge storage
declare -gA MELVIN_MODULE_DESC       # module -> description
declare -gA MELVIN_MODULE_FUNCTIONS  # module -> "func1 func2 func3"
declare -gA MELVIN_MODULE_GLOBALS    # module -> "VAR1 VAR2"
declare -gA MELVIN_MODULE_DEPS       # module -> "dep1 dep2"

# Extract description from README.md
# Usage: melvin_extract_description <module_path>
melvin_extract_description() {
    local module_path="$1"
    local readme="$module_path/README.md"

    if [[ ! -f "$readme" ]]; then
        echo ""
        return 1
    fi

    # Extract first non-empty line after title
    local desc=""
    local found_title=0

    while IFS= read -r line; do
        # Skip empty lines
        [[ -z "$line" ]] && continue

        # Skip title line (starts with #)
        if [[ "$line" =~ ^#+ ]]; then
            found_title=1
            continue
        fi

        # First non-title, non-empty line is the description
        if [[ $found_title -eq 1 ]]; then
            desc="$line"
            break
        fi
    done < "$readme"

    echo "$desc"
}

# Extract exported functions from includes.sh and main .sh files
# Usage: melvin_extract_functions <module_path> <module_name>
melvin_extract_functions() {
    local module_path="$1"
    local module_name="$2"
    local functions=""

    # Check includes.sh for exported functions
    if [[ -f "$module_path/includes.sh" ]]; then
        # Look for sourced files
        while IFS= read -r line; do
            if [[ "$line" =~ ^[[:space:]]*source[[:space:]]+(.+) ]]; then
                local source_file="${BASH_REMATCH[1]}"
                # Expand variables in path
                source_file=$(eval echo "$source_file")

                # Make path absolute if relative
                if [[ ! "$source_file" =~ ^/ ]]; then
                    source_file="$module_path/$source_file"
                fi

                # Extract exported functions from sourced file
                if [[ -f "$source_file" ]]; then
                    functions+=" $(grep -o '^[[:space:]]*export[[:space:]]-f[[:space:]]\+[a-zA-Z_][a-zA-Z0-9_]*' "$source_file" 2>/dev/null | awk '{print $NF}')"
                fi
            fi
        done < "$module_path/includes.sh"
    fi

    # Check main module file
    if [[ -f "$module_path/${module_name}.sh" ]]; then
        functions+=" $(grep -o '^[[:space:]]*export[[:space:]]-f[[:space:]]\+[a-zA-Z_][a-zA-Z0-9_]*' "$module_path/${module_name}.sh" 2>/dev/null | awk '{print $NF}')"
    fi

    # Also check for function definitions (non-exported but public)
    if [[ -f "$module_path/${module_name}.sh" ]]; then
        functions+=" $(grep -o '^[[:space:]]*[a-zA-Z_][a-zA-Z0-9_]*[[:space:]]*()' "$module_path/${module_name}.sh" 2>/dev/null | tr -d '() ' | grep -v '^_')"
    fi

    # Remove duplicates and sort
    echo "$functions" | tr ' ' '\n' | sort -u | tr '\n' ' '
}

# Extract strong globals (MODULE_SRC, MODULE_DIR patterns)
# Usage: melvin_extract_globals <module_path> <module_name>
melvin_extract_globals() {
    local module_path="$1"
    local module_name="$2"
    local module_upper=$(echo "$module_name" | tr '[:lower:]' '[:upper:]')

    local globals=""

    if [[ -f "$module_path/includes.sh" ]]; then
        # Look for : "${VAR:=...}" pattern
        globals=$(grep -o "[A-Z_]\+_SRC\|[A-Z_]\+_DIR" "$module_path/includes.sh" 2>/dev/null | sort -u | tr '\n' ' ')
    fi

    echo "$globals"
}

# Extract module dependencies (sourced modules)
# Usage: melvin_extract_dependencies <module_path>
melvin_extract_dependencies() {
    local module_path="$1"
    local deps=""

    if [[ -f "$module_path/includes.sh" ]]; then
        # Look for source statements that reference other tetra modules
        while IFS= read -r line; do
            if [[ "$line" =~ TETRA_SRC/bash/([a-zA-Z0-9_]+) ]]; then
                local dep="${BASH_REMATCH[1]}"
                deps+=" $dep"
            elif [[ "$line" =~ TETRA_BASH/([a-zA-Z0-9_]+) ]]; then
                local dep="${BASH_REMATCH[1]}"
                deps+=" $dep"
            fi
        done < "$module_path/includes.sh"
    fi

    # Remove duplicates
    echo "$deps" | tr ' ' '\n' | sort -u | grep -v '^$' | tr '\n' ' '
}

# Scan a single module and extract all knowledge
# Usage: melvin_scan_module <module_name>
melvin_scan_module() {
    local module_name="$1"
    local module_path="${TETRA_SRC}/bash/${module_name}"

    # Fallback path if TETRA_SRC not set
    if [[ -z "$TETRA_SRC" ]] || [[ ! -d "$module_path" ]]; then
        if [[ -n "$MELVIN_SRC" ]]; then
            module_path="$(dirname "$MELVIN_SRC")/${module_name}"
        else
            module_path="bash/${module_name}"
        fi
    fi

    if [[ ! -d "$module_path" ]]; then
        echo "Error: Module not found: $module_name" >&2
        return 1
    fi

    # Extract information
    MELVIN_MODULE_DESC["$module_name"]=$(melvin_extract_description "$module_path")
    MELVIN_MODULE_FUNCTIONS["$module_name"]=$(melvin_extract_functions "$module_path" "$module_name")
    MELVIN_MODULE_GLOBALS["$module_name"]=$(melvin_extract_globals "$module_path" "$module_name")
    MELVIN_MODULE_DEPS["$module_name"]=$(melvin_extract_dependencies "$module_path")
}

# Scan all modules
# Usage: melvin_scan_all
melvin_scan_all() {
    local bash_dir="${TETRA_SRC}/bash"

    # Fallback to current directory if TETRA_SRC not set
    if [[ -z "$TETRA_SRC" ]] || [[ ! -d "$bash_dir" ]]; then
        if [[ -n "$MELVIN_SRC" ]]; then
            bash_dir="$(dirname "$MELVIN_SRC")"
        else
            bash_dir="bash"
        fi
    fi

    if [[ ! -d "$bash_dir" ]]; then
        echo "Error: bash directory not found: $bash_dir" >&2
        return 1
    fi

    # Scan each subdirectory
    for dir in "$bash_dir"/*; do
        [[ ! -d "$dir" ]] && continue

        local dir_name=$(basename "$dir")

        # Skip hidden and graveyard
        [[ "$dir_name" == "."* ]] && continue
        [[ "$dir_name" == "graveyard" ]] && continue

        melvin_scan_module "$dir_name"
    done
}

# Display scan results for a module
# Usage: melvin_explain_module <module_name>
melvin_explain_module() {
    local module_name="$1"

    if [[ -z "$module_name" ]]; then
        echo "Usage: melvin_explain_module <module_name>"
        return 1
    fi

    # Ensure module is scanned
    if [[ -z "${MELVIN_MODULE_DESC[$module_name]+_}" ]]; then
        melvin_scan_module "$module_name" || return 1
    fi

    # Get classification
    if ! declare -F melvin_get_type >/dev/null 2>&1; then
        source "${MELVIN_SRC}/melvin_classifier.sh"
    fi
    melvin_classify_all >/dev/null 2>&1

    local type=$(melvin_get_type "$module_name")
    local reason=$(melvin_get_reason "$module_name")
    local features=$(melvin_get_features "$module_name")

    # Display explanation
    echo "bash/$module_name: $type"

    if [[ -n "$reason" ]]; then
        echo "  $reason"
    fi

    echo ""

    if [[ -n "${MELVIN_MODULE_DESC[$module_name]}" ]]; then
        echo "Description:"
        echo "  ${MELVIN_MODULE_DESC[$module_name]}"
        echo ""
    fi

    if [[ -n "$features" ]]; then
        echo "Features: $features"
    fi

    if [[ -n "${MELVIN_MODULE_GLOBALS[$module_name]}" ]]; then
        echo "Strong globals: ${MELVIN_MODULE_GLOBALS[$module_name]}"
    fi

    if [[ -n "${MELVIN_MODULE_FUNCTIONS[$module_name]}" ]]; then
        echo "Exported functions:"
        for func in ${MELVIN_MODULE_FUNCTIONS[$module_name]}; do
            echo "  - $func"
        done
        echo ""
    fi

    if [[ -n "${MELVIN_MODULE_DEPS[$module_name]}" ]]; then
        echo "Dependencies: ${MELVIN_MODULE_DEPS[$module_name]}"
        echo ""
    fi

    # Additional stats
    local module_path="${TETRA_SRC}/bash/${module_name}"
    if [[ -d "$module_path" ]]; then
        local loc=$(find "$module_path" -type f -name "*.sh" -exec cat {} \; 2>/dev/null | wc -l | tr -d ' ')
        echo "LOC: ~$loc lines"

        if command -v stat >/dev/null 2>&1; then
            local last_file=$(find "$module_path" -type f -name "*.sh" -exec stat -f "%m %N" {} \; 2>/dev/null | sort -rn | head -1 | awk '{print $2}')
            if [[ -n "$last_file" ]]; then
                local mod_date=$(stat -f "%Sm" -t "%Y-%m-%d" "$last_file" 2>/dev/null)
                [[ -n "$mod_date" ]] && echo "Last modified: $mod_date"
            fi
        fi

        # Check boot registration
        if grep -q "tetra_register_module.*['\"]${module_name}['\"]" "${TETRA_SRC}/bash/boot/boot_modules.sh" 2>/dev/null; then
            local line_num=$(grep -n "tetra_register_module.*['\"]${module_name}['\"]" "${TETRA_SRC}/bash/boot/boot_modules.sh" | cut -d: -f1)
            echo "Registered: ✓ boot_modules.sh:$line_num"
        else
            echo "Registered: ✗ Not in boot_modules.sh"
        fi
    fi

    echo ""
    echo "Classification: $type (${reason})"
}

# Export functions
export -f melvin_extract_description
export -f melvin_extract_functions
export -f melvin_extract_globals
export -f melvin_extract_dependencies
export -f melvin_scan_module
export -f melvin_scan_all
export -f melvin_explain_module
