#!/usr/bin/env bash
# REPL Metadata System
# Every REPL instance has introspectable metadata

# REPL metadata (associative array)
declare -gA REPL_META=(
    [name]=""
    [module]=""
    [version]="1.0"
    [description]=""
    [namespace]=""
    [completion_style]="cycle"  # cycle, menu, inline
    [completion_position]="above"  # above, below
    [prompt_style]="default"
    [history_enabled]="true"
    [history_file]=""
)

# Set REPL metadata
# Usage: repl_meta_set "key" "value"
repl_meta_set() {
    REPL_META["$1"]="$2"
}

# Get REPL metadata
# Usage: value=$(repl_meta_get "key")
repl_meta_get() {
    echo "${REPL_META[$1]}"
}

# Show all REPL metadata
repl_meta_show() {
    echo ""
    echo "═══ REPL Metadata ═══"
    echo ""

    local max_key_len=0
    for key in "${!REPL_META[@]}"; do
        if [[ ${#key} -gt $max_key_len ]]; then
            max_key_len=${#key}
        fi
    done

    # Sort and display
    for key in $(printf '%s\n' "${!REPL_META[@]}" | sort); do
        local value="${REPL_META[$key]}"
        printf "  %-${max_key_len}s : %s\n" "$key" "$value"
    done
    echo ""
}

# Edit REPL metadata interactively
repl_meta_edit() {
    local key="$1"

    if [[ -z "$key" ]]; then
        # Show menu of editable fields
        echo "Select field to edit:"
        local i=1
        local keys=()
        for k in $(printf '%s\n' "${!REPL_META[@]}" | sort); do
            keys+=("$k")
            echo "  [$i] $k = ${REPL_META[$k]}"
            ((i++))
        done

        read -p "Enter number (or field name): " choice

        if [[ "$choice" =~ ^[0-9]+$ ]] && [[ $choice -ge 1 ]] && [[ $choice -le ${#keys[@]} ]]; then
            key="${keys[$((choice-1))]}"
        else
            key="$choice"
        fi
    fi

    if [[ -z "${REPL_META[$key]+x}" ]]; then
        echo "Unknown metadata key: $key"
        return 1
    fi

    local current="${REPL_META[$key]}"
    echo ""
    echo "Editing: $key"
    echo "Current value: $current"
    read -p "New value: " new_value

    if [[ -n "$new_value" ]]; then
        REPL_META["$key"]="$new_value"
        echo "✓ Updated $key = $new_value"

        # Apply changes if needed
        _repl_meta_apply_change "$key" "$new_value"
    fi
}

# Apply metadata changes (hook for side effects)
_repl_meta_apply_change() {
    local key="$1"
    local value="$2"

    case "$key" in
        completion_position)
            if command -v repl_set_completion_menu_position >/dev/null 2>&1; then
                repl_set_completion_menu_position "$value"
            fi
            ;;
        completion_style)
            # Could affect how TAB behaves
            ;;
    esac
}

# Initialize REPL metadata for a module
# Usage: repl_meta_init "name" "module" "description"
repl_meta_init() {
    REPL_META[name]="$1"
    REPL_META[module]="$2"
    REPL_META[description]="$3"
    REPL_META[namespace]="${4:-${2}}"
}

# Export functions
export -f repl_meta_set
export -f repl_meta_get
export -f repl_meta_show
export -f repl_meta_edit
export -f repl_meta_init
export -f _repl_meta_apply_change
