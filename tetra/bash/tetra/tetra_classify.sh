#!/usr/bin/env bash
# tetra_classify.sh - Module classification, owned by tetra, steered by melvin
# Usage: source this file, then call tetra_classify_dir or tetra_classify_all

: "${TETRA_SRC:?TETRA_SRC must be set}"

# =============================================================================
# CLASSIFICATION RULES (melvin can override via TETRA_CLASSIFY_RULES)
# =============================================================================
# Format: "pattern=TYPE" where pattern is file checks joined by +
# Order matters - first match wins

declare -ga TETRA_CLASSIFY_RULES=(
    "actions.sh+*_tui.sh=APP+MODULE"
    "actions.sh=MODULE"
    "*_tui.sh=APP"
    "tui.sh=APP"
    "includes.sh=LIBRARY"
    "ANY.sh=SCRIPTS"
)

# Load melvin overrides if available
[[ -f "$TETRA_SRC/bash/melvin/classify_rules.sh" ]] && \
    source "$TETRA_SRC/bash/melvin/classify_rules.sh"

# =============================================================================
# CLASSIFICATION CACHE
# =============================================================================

declare -gA TETRA_MOD_TYPE=()      # mod_name -> type
declare -gA TETRA_MOD_REASON=()    # mod_name -> reason
declare -ga TETRA_MOD_LIST=()      # ordered list of mod names

# =============================================================================
# CORE FUNCTIONS
# =============================================================================

# Classify a single module directory
# Usage: tetra_classify_dir <dir_path>
# Sets: TETRA_MOD_TYPE[name], TETRA_MOD_REASON[name]
tetra_classify_dir() {
    local dir="$1"
    [[ ! -d "$dir" ]] && return 1

    local name=$(basename "$dir")
    local type="UNKNOWN"
    local reason="No patterns matched"

    # Check each rule
    for rule in "${TETRA_CLASSIFY_RULES[@]}"; do
        local pattern="${rule%=*}"
        local rtype="${rule#*=}"

        if _tetra_check_pattern "$dir" "$name" "$pattern"; then
            type="$rtype"
            reason="Matched: $pattern"
            break
        fi
    done

    TETRA_MOD_TYPE["$name"]="$type"
    TETRA_MOD_REASON["$name"]="$reason"
}

# Check if directory matches a pattern
# Patterns: "file1+file2" means both must exist
# Wildcards: "*_tui.sh" expands to "${name}_tui.sh"
# Special: "ANY.sh" means any .sh file exists
_tetra_check_pattern() {
    local dir="$1"
    local name="$2"
    local pattern="$3"

    # Split on + for AND conditions
    local IFS='+'
    read -ra parts <<< "$pattern"

    for part in "${parts[@]}"; do
        # Special case: ANY.sh means any .sh file exists
        if [[ "$part" == "ANY.sh" ]]; then
            [[ -z "$(ls "$dir"/*.sh 2>/dev/null | head -1)" ]] && return 1
            continue
        fi

        # Expand wildcards (* -> module name)
        local file="${part//\*/$name}"

        # Check existence
        [[ ! -f "$dir/$file" ]] && return 1
    done
    return 0
}

# Classify all modules in a directory
# Usage: tetra_classify_all [root_path]
tetra_classify_all() {
    local root="${1:-$TETRA_SRC/bash}"

    # Clear cache
    TETRA_MOD_TYPE=()
    TETRA_MOD_REASON=()
    TETRA_MOD_LIST=()

    [[ ! -d "$root" ]] && return 1

    for dir in "$root"/*/; do
        [[ ! -d "$dir" ]] && continue
        local name=$(basename "$dir")

        # Skip special directories
        [[ "$name" == "tetra" || "$name" == "wip" || "$name" == "graveyard" ]] && continue
        [[ "$name" == "."* ]] && continue

        # Must have at least one .sh file
        [[ -z "$(ls "$dir"/*.sh 2>/dev/null | head -1)" ]] && continue

        tetra_classify_dir "$dir"
        TETRA_MOD_LIST+=("$name")
    done

    # Sort the list
    IFS=$'\n' TETRA_MOD_LIST=($(printf '%s\n' "${TETRA_MOD_LIST[@]}" | sort)); unset IFS
}

# Get type for a module (classifies if not cached)
# Usage: tetra_get_type <mod_name> [root_path]
tetra_get_type() {
    local name="$1"
    local root="${2:-$TETRA_SRC/bash}"

    if [[ -z "${TETRA_MOD_TYPE[$name]}" ]]; then
        tetra_classify_dir "$root/$name"
    fi
    echo "${TETRA_MOD_TYPE[$name]:-UNKNOWN}"
}

# List modules by type
# Usage: tetra_list_by_type <type> [root_path]
tetra_list_by_type() {
    local target_type="$1"
    local root="${2:-$TETRA_SRC/bash}"

    # Ensure classified
    [[ ${#TETRA_MOD_LIST[@]} -eq 0 ]] && tetra_classify_all "$root"

    for name in "${TETRA_MOD_LIST[@]}"; do
        [[ "${TETRA_MOD_TYPE[$name]}" == "$target_type" ]] && echo "$name"
    done
}

# Count modules by type
# Usage: tetra_count_types [root_path]
tetra_count_types() {
    local root="${1:-$TETRA_SRC/bash}"

    # Ensure classified
    [[ ${#TETRA_MOD_LIST[@]} -eq 0 ]] && tetra_classify_all "$root"

    declare -A counts
    for name in "${TETRA_MOD_LIST[@]}"; do
        local t="${TETRA_MOD_TYPE[$name]}"
        ((counts[$t]++))
    done

    for t in LIBRARY MODULE APP APP+MODULE SCRIPTS UNKNOWN; do
        [[ ${counts[$t]:-0} -gt 0 ]] && printf "%-12s %d\n" "$t" "${counts[$t]}"
    done
}

# Show classification for a module
# Usage: tetra_show_type <mod_name>
tetra_show_type() {
    local name="$1"
    tetra_get_type "$name" >/dev/null
    printf "%s: %s (%s)\n" "$name" "${TETRA_MOD_TYPE[$name]}" "${TETRA_MOD_REASON[$name]}"
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f tetra_classify_dir
export -f tetra_classify_all
export -f tetra_get_type
export -f tetra_list_by_type
export -f tetra_count_types
export -f tetra_show_type
