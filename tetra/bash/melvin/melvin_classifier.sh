#!/usr/bin/env bash

# MELVIN Classifier - Directory Taxonomy Engine
# Machine Electronics Live Virtual Intelligence Network
#
# Classifies bash directories into:
#   - LIBRARY: Has includes.sh only (no actions, no TUI)
#   - MODULE:  Has actions.sh (probably has REPL)
#   - APP:     Implements TUI (*_tui.sh or TUI framework)
#   - APP+MODULE: Has both actions.sh and TUI
#   - UNKNOWN: Doesn't fit classification patterns

# Strong globals
: "${MELVIN_SRC:=$TETRA_SRC/bash/melvin}"
: "${MELVIN_DIR:=$TETRA_DIR/melvin}"

# Classification result structure (associative array)
declare -gA MELVIN_CLASS_TYPE      # dir -> type
declare -gA MELVIN_CLASS_REASON    # dir -> reason
declare -gA MELVIN_CLASS_FEATURES  # dir -> "includes actions repl tui"

# Classify a single directory
# Usage: melvin_classify_dir <dir_path>
# Returns: Sets MELVIN_CLASS_TYPE, MELVIN_CLASS_REASON, MELVIN_CLASS_FEATURES
melvin_classify_dir() {
    local dir="$1"
    local dir_name=$(basename "$dir")

    # Skip if not a directory
    [[ ! -d "$dir" ]] && return 1

    # Detection flags
    local has_includes=0
    local has_actions=0
    local has_repl=0
    local has_tui=0

    # Check for key files
    [[ -f "$dir/includes.sh" ]] && has_includes=1
    [[ -f "$dir/actions.sh" ]] && has_actions=1

    # Check for REPL (multiple patterns)
    if [[ -f "$dir/${dir_name}_repl.sh" ]] || \
       [[ -f "$dir/repl.sh" ]] || \
       find "$dir" -maxdepth 1 -name "*repl*.sh" -type f 2>/dev/null | grep -q .; then
        has_repl=1
    fi

    # Check for TUI
    if [[ -f "$dir/${dir_name}_tui.sh" ]] || \
       [[ -f "$dir/tui.sh" ]] || \
       find "$dir" -maxdepth 1 -name "*tui*.sh" -type f 2>/dev/null | grep -q .; then
        has_tui=1
    fi

    # Build features string
    local features=""
    [[ $has_includes -eq 1 ]] && features+="includes "
    [[ $has_actions -eq 1 ]] && features+="actions "
    [[ $has_repl -eq 1 ]] && features+="repl "
    [[ $has_tui -eq 1 ]] && features+="tui "
    MELVIN_CLASS_FEATURES["$dir_name"]="${features% }"

    # Classification logic
    local type="UNKNOWN"
    local reason=""

    if [[ $has_actions -eq 1 ]] && [[ $has_tui -eq 1 ]]; then
        type="APP+MODULE"
        reason="Has actions.sh and TUI implementation"
    elif [[ $has_tui -eq 1 ]]; then
        type="APP"
        reason="Has TUI implementation"
    elif [[ $has_actions -eq 1 ]]; then
        type="MODULE"
        reason="Has actions.sh"
        [[ $has_repl -eq 1 ]] && reason+=" (with REPL)"
    elif [[ $has_includes -eq 1 ]]; then
        type="LIBRARY"
        reason="Has includes.sh only (no actions, no TUI)"
    else
        reason="No standard tetra patterns detected"
    fi

    # Store classification
    MELVIN_CLASS_TYPE["$dir_name"]="$type"
    MELVIN_CLASS_REASON["$dir_name"]="$reason"
}

# Classify all directories in bash/
# Usage: melvin_classify_all [--rescan]
melvin_classify_all() {
    local rescan=0
    [[ "$1" == "--rescan" ]] && rescan=1

    # Load cache if exists and not rescanning
    if [[ $rescan -eq 0 ]] && [[ -f "$MELVIN_DIR/classification.json" ]]; then
        if melvin_load_classification_cache; then
            return 0  # Successfully loaded from cache
        fi
        # Cache load failed, fall through to rescan
    fi

    # Clear existing classification
    MELVIN_CLASS_TYPE=()
    MELVIN_CLASS_REASON=()
    MELVIN_CLASS_FEATURES=()

    # Scan bash/ directory
    local bash_dir="${TETRA_SRC}/bash"

    # Fallback to current directory if TETRA_SRC not set
    if [[ -z "$TETRA_SRC" ]] || [[ ! -d "$bash_dir" ]]; then
        # Try relative path from MELVIN_SRC
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

    # Classify each subdirectory
    for dir in "$bash_dir"/*; do
        [[ ! -d "$dir" ]] && continue

        # Skip hidden directories and graveyard
        local dir_name=$(basename "$dir")
        [[ "$dir_name" == "."* ]] && continue
        [[ "$dir_name" == "graveyard" ]] && continue

        melvin_classify_dir "$dir"
    done

    # Save cache
    melvin_save_classification_cache
}

# Get classification for a directory
# Usage: melvin_get_type <dir_name>
melvin_get_type() {
    local dir_name="$1"
    echo "${MELVIN_CLASS_TYPE[$dir_name]:-UNKNOWN}"
}

# Get classification reason
# Usage: melvin_get_reason <dir_name>
melvin_get_reason() {
    local dir_name="$1"
    echo "${MELVIN_CLASS_REASON[$dir_name]}"
}

# Get features
# Usage: melvin_get_features <dir_name>
melvin_get_features() {
    local dir_name="$1"
    echo "${MELVIN_CLASS_FEATURES[$dir_name]}"
}

# List all directories of a specific type
# Usage: melvin_list_by_type <type>
# Types: LIBRARY, MODULE, APP, APP+MODULE, UNKNOWN
melvin_list_by_type() {
    local target_type="$1"

    for dir_name in "${!MELVIN_CLASS_TYPE[@]}"; do
        if [[ "${MELVIN_CLASS_TYPE[$dir_name]}" == "$target_type" ]]; then
            echo "$dir_name"
        fi
    done | sort
}

# Count directories by type
# Usage: melvin_count_by_type
# Returns: Associative array counts
melvin_count_by_type() {
    declare -gA MELVIN_TYPE_COUNTS
    MELVIN_TYPE_COUNTS=()

    for type in LIBRARY MODULE APP "APP+MODULE" UNKNOWN; do
        local count=0
        for dir_name in "${!MELVIN_CLASS_TYPE[@]}"; do
            [[ "${MELVIN_CLASS_TYPE[$dir_name]}" == "$type" ]] && ((count++))
        done
        MELVIN_TYPE_COUNTS["$type"]=$count
    done
}

# Save classification to cache
melvin_save_classification_cache() {
    mkdir -p "$MELVIN_DIR"
    local cache_file="$MELVIN_DIR/classification.json"

    # Simple JSON export (manual construction for bash compatibility)
    {
        echo "{"
        echo '  "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",'
        echo '  "classifications": {'

        local first=1
        for dir_name in $(printf '%s\n' "${!MELVIN_CLASS_TYPE[@]}" | sort); do
            [[ $first -eq 0 ]] && echo ","
            first=0

            echo -n '    "'$dir_name'": {'
            echo -n '"type": "'${MELVIN_CLASS_TYPE[$dir_name]}'",'
            echo -n '"reason": "'${MELVIN_CLASS_REASON[$dir_name]}'",'
            echo -n '"features": "'${MELVIN_CLASS_FEATURES[$dir_name]}'"'
            echo -n '}'
        done
        echo ""
        echo "  }"
        echo "}"
    } > "$cache_file"
}

# Load classification from cache
melvin_load_classification_cache() {
    local cache_file="$MELVIN_DIR/classification.json"

    [[ ! -f "$cache_file" ]] && return 1

    # Simple JSON parsing for our structured format
    # This is a quick implementation - could be improved with jq if available

    # For now, just return success and let rescan happen
    # TODO: Implement proper JSON parsing or require jq
    return 1
}

# Export functions
export -f melvin_classify_dir
export -f melvin_classify_all
export -f melvin_get_type
export -f melvin_get_reason
export -f melvin_get_features
export -f melvin_list_by_type
export -f melvin_count_by_type
export -f melvin_save_classification_cache
export -f melvin_load_classification_cache
