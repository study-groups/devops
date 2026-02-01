#!/usr/bin/env bash
# deploy_items.sh - Item editing, parsing, filtering, and run operations
#
# Functions: _deploy_edit_items, _deploy_parse_item_args,
#            _deploy_apply_oneshot_filters, deploy_run

# =============================================================================
# ITEMS / RUN OPERATIONS
# =============================================================================

# Edit items in $EDITOR, return remaining items
# Usage: _deploy_edit_items
_deploy_edit_items() {
    local editor="${VISUAL:-${EDITOR:-vi}}"
    local tmpfile

    tmpfile=$(mktemp "${TMPDIR:-/tmp}/deploy-items.XXXXXX")

    # Write items to temp file
    printf '%s\n' "${DEPLOY_CTX_ITEMS[@]}" > "$tmpfile"

    # Open editor
    "$editor" "$tmpfile"
    local rc=$?

    if [[ $rc -ne 0 ]]; then
        echo "Editor exited with error" >&2
        rm -f "$tmpfile"
        return 1
    fi

    # Read back, filter empty/comment lines
    DEPLOY_CTX_ITEMS=()
    while IFS= read -r line; do
        # Skip empty lines and comments
        [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
        # Trim whitespace
        line="${line#"${line%%[![:space:]]*}"}"
        line="${line%"${line##*[![:space:]]}"}"
        [[ -n "$line" ]] && DEPLOY_CTX_ITEMS+=("$line")
    done < "$tmpfile"

    rm -f "$tmpfile"
    DEPLOY_CTX_ITEMS_MODIFIED=1

    if [[ ${#DEPLOY_CTX_ITEMS[@]} -eq 0 ]]; then
        echo "No items remaining after edit" >&2
        return 1
    fi

    echo "Items after edit: ${DEPLOY_CTX_ITEMS[*]} (${#DEPLOY_CTX_ITEMS[@]})"
    return 0
}

# Parse -item and =item arguments, return remaining args
# Sets DEPLOY_ONESHOT_EXCLUDE and DEPLOY_ONESHOT_INCLUDE arrays
_deploy_parse_item_args() {
    DEPLOY_ONESHOT_EXCLUDE=()
    DEPLOY_ONESHOT_INCLUDE=()
    DEPLOY_REMAINING_ARGS=()

    for arg in "$@"; do
        case "$arg" in
            --edit)
                DEPLOY_EDIT_MODE=1
                ;;
            --only)
                # Next arg is glob, handled by caller
                DEPLOY_REMAINING_ARGS+=("$arg")
                ;;
            -[a-zA-Z_]*)
                # Exclude: -itemname (but not flags like -n)
                local item="${arg#-}"
                # Skip known flags
                [[ "$item" == "n" || "$item" == "v" ]] && { DEPLOY_REMAINING_ARGS+=("$arg"); continue; }
                DEPLOY_ONESHOT_EXCLUDE+=("$item")
                ;;
            =[a-zA-Z_]*)
                # Include-only: =itemname
                DEPLOY_ONESHOT_INCLUDE+=("${arg#=}")
                ;;
            *)
                DEPLOY_REMAINING_ARGS+=("$arg")
                ;;
        esac
    done
}

# Apply one-shot item filters (without modifying context)
# Returns filtered items in DEPLOY_WORKING_ITEMS
_deploy_apply_oneshot_filters() {
    DEPLOY_WORKING_ITEMS=("${DEPLOY_CTX_ITEMS[@]}")

    # Apply include-only filter
    if [[ ${#DEPLOY_ONESHOT_INCLUDE[@]} -gt 0 ]]; then
        local new_items=()
        for item in "${DEPLOY_WORKING_ITEMS[@]}"; do
            for inc in "${DEPLOY_ONESHOT_INCLUDE[@]}"; do
                [[ "$item" == "$inc" ]] && { new_items+=("$item"); break; }
            done
        done
        DEPLOY_WORKING_ITEMS=("${new_items[@]}")
    fi

    # Apply exclude filter
    if [[ ${#DEPLOY_ONESHOT_EXCLUDE[@]} -gt 0 ]]; then
        local new_items=()
        for item in "${DEPLOY_WORKING_ITEMS[@]}"; do
            local exclude=0
            for ex in "${DEPLOY_ONESHOT_EXCLUDE[@]}"; do
                [[ "$item" == "$ex" ]] && { exclude=1; break; }
            done
            [[ $exclude -eq 0 ]] && new_items+=("$item")
        done
        DEPLOY_WORKING_ITEMS=("${new_items[@]}")
    fi
}

# Run operation on items
# Usage: deploy run <operation> [operation...]
#        deploy run build sync
deploy_run() {
    local operations=()
    local dry_run=0

    # Parse args
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -n|--dry-run) dry_run=1; shift ;;
            *) operations+=("$1"); shift ;;
        esac
    done

    # Need target and items
    if [[ -z "$DEPLOY_CTX_TARGET" ]]; then
        echo "Need target - run: deploy target <name>" >&2
        return 1
    fi

    if [[ ${#DEPLOY_CTX_ITEMS[@]} -eq 0 ]]; then
        echo "No items to operate on" >&2
        return 1
    fi

    # Default operation from pipeline
    if [[ ${#operations[@]} -eq 0 ]]; then
        if [[ -n "$DEPLOY_CTX_PIPELINE" ]]; then
            operations=("$DEPLOY_CTX_PIPELINE")
        else
            echo "No operation specified and no default pipeline" >&2
            return 1
        fi
    fi

    local toml
    if [[ "$DEPLOY_CTX_TARGET" == "." ]]; then
        toml="./tetra-deploy.toml"
    else
        toml=$(_deploy_find_target "$DEPLOY_CTX_TARGET")
    fi

    if [[ -z "$toml" || ! -f "$toml" ]]; then
        echo "Target TOML not found: $DEPLOY_CTX_TARGET" >&2
        return 1
    fi

    echo "Running: ${operations[*]}"
    echo "Items: ${DEPLOY_CTX_ITEMS[*]} (${#DEPLOY_CTX_ITEMS[@]})"
    [[ $dry_run -eq 1 ]] && echo "[DRY RUN]"
    echo ""

    # Run each operation
    for op in "${operations[@]}"; do
        echo "[${op}]"

        for item in "${DEPLOY_CTX_ITEMS[@]}"; do
            local value=$(_deploy_items_get_value "$toml" "$item")
            [[ -z "$value" ]] && { echo "  $item: (no value, skipping)"; continue; }

            echo "  $item: $value"

            # Here you would run the actual operation
            # For now, just show what would be done
            if [[ $dry_run -eq 0 ]]; then
                # TODO: Integrate with de_run or pipeline system
                :
            fi
        done

        echo ""
    done

    echo "Done"
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f _deploy_edit_items _deploy_parse_item_args _deploy_apply_oneshot_filters
export -f deploy_run
