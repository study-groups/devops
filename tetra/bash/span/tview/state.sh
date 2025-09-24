#!/usr/bin/env bash

# Span TView State Management - UI state and span context

# Span UI state variables
SPAN_CURRENT_ITEM=0
SPAN_MARKED_SPANS=()
SPAN_EXPANDED_SPANS=()
SPAN_EDITING_SPAN=""
SPAN_VIEW_MODE="overview"        # overview|detail|search
SPAN_FILTER=""                   # Search filter
SPAN_SORT="slot"                 # slot|name|size|date
SPAN_UNDO_STACK=()              # Operation history
SPAN_MODIFIED=false             # Has unsaved changes

# Active multispan context
ACTIVE_SPAN_MULTISPAN=""         # Currently active multispan name
ACTIVE_SPAN_SLOT=""              # Currently selected storage slot

# Get span UI state
span_get_state() {
    cat << EOF
SPAN_CURRENT_ITEM=$SPAN_CURRENT_ITEM
SPAN_VIEW_MODE=$SPAN_VIEW_MODE
SPAN_FILTER=$SPAN_FILTER
SPAN_SORT=$SPAN_SORT
SPAN_MODIFIED=$SPAN_MODIFIED
ACTIVE_SPAN_MULTISPAN=$ACTIVE_SPAN_MULTISPAN
ACTIVE_SPAN_SLOT=$ACTIVE_SPAN_SLOT
MARKED_COUNT=${#SPAN_MARKED_SPANS[@]}
EXPANDED_COUNT=${#SPAN_EXPANDED_SPANS[@]}
UNDO_AVAILABLE=${#SPAN_UNDO_STACK[@]}
EOF
}

# Set span UI state
span_set_state() {
    local key="$1"
    local value="$2"

    case "$key" in
        "current_item")
            SPAN_CURRENT_ITEM="$value"
            ;;
        "view_mode")
            SPAN_VIEW_MODE="$value"
            ;;
        "filter")
            SPAN_FILTER="$value"
            ;;
        "sort")
            SPAN_SORT="$value"
            ;;
        "active_multispan")
            ACTIVE_SPAN_MULTISPAN="$value"
            ;;
        "active_slot")
            ACTIVE_SPAN_SLOT="$value"
            ;;
        *)
            echo "Unknown state key: $key" >&2
            return 1
            ;;
    esac
}

# Reset span state to defaults
span_reset_state() {
    SPAN_CURRENT_ITEM=0
    SPAN_MARKED_SPANS=()
    SPAN_EXPANDED_SPANS=()
    SPAN_EDITING_SPAN=""
    SPAN_VIEW_MODE="overview"
    SPAN_FILTER=""
    SPAN_SORT="slot"
    SPAN_UNDO_STACK=()
    SPAN_MODIFIED=false
    ACTIVE_SPAN_MULTISPAN=""
    ACTIVE_SPAN_SLOT=""
    echo "Span state reset to defaults"
}

# Mark/unmark span for bulk operations
span_toggle_mark() {
    local span_id="$1"
    if [[ -z "$span_id" ]]; then
        span_id="$SPAN_CURRENT_ITEM"
    fi

    # Check if already marked
    local marked=false
    local new_marked=()
    for marked_span in "${SPAN_MARKED_SPANS[@]}"; do
        if [[ "$marked_span" == "$span_id" ]]; then
            marked=true
        else
            new_marked+=("$marked_span")
        fi
    done

    if [[ "$marked" == "true" ]]; then
        SPAN_MARKED_SPANS=("${new_marked[@]}")
        echo "Unmarked span: $span_id"
    else
        SPAN_MARKED_SPANS+=("$span_id")
        echo "Marked span: $span_id"
    fi
}

# Expand/collapse span details
span_toggle_expand() {
    local span_id="$1"
    if [[ -z "$span_id" ]]; then
        span_id="$SPAN_CURRENT_ITEM"
    fi

    # Check if already expanded
    local expanded=false
    local new_expanded=()
    for expanded_span in "${SPAN_EXPANDED_SPANS[@]}"; do
        if [[ "$expanded_span" == "$span_id" ]]; then
            expanded=true
        else
            new_expanded+=("$expanded_span")
        fi
    done

    if [[ "$expanded" == "true" ]]; then
        SPAN_EXPANDED_SPANS=("${new_expanded[@]}")
        echo "Collapsed span: $span_id"
    else
        SPAN_EXPANDED_SPANS+=("$span_id")
        echo "Expanded span: $span_id"
    fi
}

# Add operation to undo stack
span_add_to_undo() {
    local operation="$1"
    local timestamp=$(date +%s)
    SPAN_UNDO_STACK+=("$timestamp:$operation")

    # Keep only last 10 operations
    if [[ ${#SPAN_UNDO_STACK[@]} -gt 10 ]]; then
        SPAN_UNDO_STACK=("${SPAN_UNDO_STACK[@]:1}")
    fi

    SPAN_MODIFIED=true
}

# Undo last operation
span_undo_last() {
    if [[ ${#SPAN_UNDO_STACK[@]} -eq 0 ]]; then
        echo "No operations to undo"
        return 1
    fi

    local last_op="${SPAN_UNDO_STACK[-1]}"
    SPAN_UNDO_STACK=("${SPAN_UNDO_STACK[@]:0:${#SPAN_UNDO_STACK[@]}-1}")

    local timestamp="${last_op%%:*}"
    local operation="${last_op#*:}"

    echo "Undoing: $operation (from $(date -d @$timestamp '+%H:%M:%S'))"

    # Here you would implement the actual undo logic
    # For now, just report what would be undone
    case "$operation" in
        "store_"*)
            echo "Would undo: store operation"
            ;;
        "create_"*)
            echo "Would undo: create operation"
            ;;
        "delete_"*)
            echo "Would undo: delete operation"
            ;;
        *)
            echo "Would undo: $operation"
            ;;
    esac
}

# Save current span state to file
span_save_state() {
    local state_file="${TETRA_DIR:-$HOME/tetra}/span/state.sh"
    mkdir -p "$(dirname "$state_file")"

    cat > "$state_file" << EOF
# Span module state - $(date)
$(span_get_state)

# Storage metadata
$(declare -p SPAN_METADATA 2>/dev/null || echo "declare -A SPAN_METADATA=()")

# Marked and expanded spans
SPAN_MARKED_SPANS=(${SPAN_MARKED_SPANS[*]})
SPAN_EXPANDED_SPANS=(${SPAN_EXPANDED_SPANS[*]})
EOF

    echo "Span state saved to: $state_file"
    SPAN_MODIFIED=false
}

# Load span state from file
span_load_state() {
    local state_file="${TETRA_DIR:-$HOME/tetra}/span/state.sh"

    if [[ -f "$state_file" ]]; then
        source "$state_file"
        echo "Span state loaded from: $state_file"
        SPAN_MODIFIED=false
    else
        echo "No saved state found at: $state_file"
        return 1
    fi
}

# Initialize span state
span_init_state() {
    # Load saved state if available
    span_load_state 2>/dev/null || true

    # Set defaults if not loaded
    SPAN_CURRENT_ITEM=${SPAN_CURRENT_ITEM:-0}
    SPAN_VIEW_MODE=${SPAN_VIEW_MODE:-"overview"}
    SPAN_SORT=${SPAN_SORT:-"slot"}

    echo "Span state initialized"
}

# Export state functions
export -f span_get_state span_set_state span_reset_state
export -f span_toggle_mark span_toggle_expand
export -f span_save_state span_load_state span_init_state