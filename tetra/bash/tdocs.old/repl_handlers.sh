#!/usr/bin/env bash
# tdocs REPL command handlers
# Extracted from _tdocs_repl_process_input for maintainability

# =============================================================================
# Sort Handler
# =============================================================================

_tdocs_handle_sort() {
    local key="$1"
    case "$key" in
        r)
            TDOCS_REPL_SORT="relevance"
            echo "Sort: relevance (recency + level + context)"
            ;;
        t)
            TDOCS_REPL_SORT="time"
            echo "Sort: time (newest first)"
            ;;
        l)
            TDOCS_REPL_SORT="level"
            echo "Sort: level (highest completeness first)"
            ;;
        a)
            TDOCS_REPL_SORT="alpha"
            echo "Sort: alphabetical"
            ;;
        *)
            return 1
            ;;
    esac
    return 2  # Signal prompt refresh
}

# =============================================================================
# Shell Escape Handler
# =============================================================================

_tdocs_handle_shell_escape() {
    local shell_cmd="$1"

    # Block dangerous patterns (injection vectors)
    if [[ "$shell_cmd" =~ [\`\$\(] ]] || \
       [[ "$shell_cmd" =~ \>\> ]] || \
       [[ "$shell_cmd" =~ \|\| ]] || \
       [[ "$shell_cmd" =~ \&\& ]] || \
       [[ "$shell_cmd" =~ [[:space:]]rm[[:space:]]+-rf ]] || \
       [[ "$shell_cmd" =~ ^[[:space:]]*sudo ]]; then
        echo "Shell escape blocked: potentially unsafe command"
        echo "Use a full terminal for complex commands"
        return 0
    fi

    # Execute allowed commands
    eval "$shell_cmd"
    return 0
}

# =============================================================================
# Find Handler
# =============================================================================

_tdocs_handle_find() {
    local args="$1"
    local -a find_args=($args)

    if [[ ${#find_args[@]} -eq 0 ]]; then
        _tdocs_find_show_help
        return 0
    fi

    # Handle reset commands
    if [[ "${find_args[0]}" == "all" ]] || \
       [[ "${find_args[0]}" == "clear" ]] || \
       [[ "${find_args[0]}" == "reset" ]]; then
        _tdocs_clear_filters
        echo "Filters cleared - showing all documents"
        echo ""
        tdocs ls --numbered
        return 2
    fi

    # Parse arguments into modules, types, and search terms
    local -a modules=()
    local -a types=()
    local -a search_terms=()

    # Known modules and types for detection
    local known_modules="rag midi tdocs repl tcurses tree tds tsm boot game org tgp osc"
    local known_types="spec guide investigation reference plan summary scratch bug-fix refactor"

    for arg in "${find_args[@]}"; do
        # Normalize plural forms
        local singular="$arg"
        if [[ "$arg" == *s ]] && [[ " $known_types " == *" ${arg%s} "* ]]; then
            singular="${arg%s}"
        fi

        if [[ " $known_modules " == *" $arg "* ]]; then
            modules+=("$arg")
        elif [[ " $known_types " == *" $singular "* ]]; then
            types+=("$singular")
        else
            search_terms+=("$arg")
        fi
    done

    # Apply filters
    local did_filter=false

    if [[ ${#modules[@]} -gt 0 ]]; then
        TDOCS_REPL_MODULES=("${modules[@]}")
        TDOCS_REPL_DOC_COUNT=0
        TDOCS_REPL_STATE="find"
        echo "Find: modules = ${modules[*]}"
        did_filter=true
    fi

    if [[ ${#types[@]} -gt 0 ]]; then
        TDOCS_REPL_TYPE=("${types[@]}")
        TDOCS_REPL_DOC_COUNT=0
        TDOCS_REPL_STATE="find"
        echo "Find: types = ${types[*]}"
        did_filter=true
    fi

    if [[ ${#search_terms[@]} -gt 0 ]]; then
        local query="${search_terms[*]}"
        tdocs search "$query"
        return $?
    fi

    if [[ "$did_filter" == true ]]; then
        echo ""
        tdocs ls --numbered
    fi

    return 2
}

_tdocs_find_show_help() {
    echo "Find mode: showing current context"
    echo "Modules: ${TDOCS_REPL_MODULES[*]:-all}"
    echo "Types: ${TDOCS_REPL_TYPE[*]:-all}"
    echo ""
    echo "Usage: find <modules/types/query...>"
    echo "  find all            - Reset filters, show all documents"
    echo "  find midi           - Filter by midi module"
    echo "  find midi osc       - Filter by midi and osc modules"
    echo "  find spec guide     - Filter by spec and guide types"
}

# =============================================================================
# Filter Handler
# =============================================================================

_tdocs_handle_filter() {
    local args="$1"
    local -a filter_args=($args)
    local filter_type="${filter_args[0]}"

    case "$filter_type" in
        module|mod|m)
            _tdocs_filter_apply "TDOCS_REPL_MODULES" "${filter_args[@]:1}" "modules"
            return 2
            ;;
        type|t)
            _tdocs_filter_apply "TDOCS_REPL_TYPE" "${filter_args[@]:1}" "type"
            return 2
            ;;
        intent|i)
            _tdocs_filter_apply "TDOCS_REPL_INTENT" "${filter_args[@]:1}" "intent"
            return 2
            ;;
        lifecycle|lc)
            _tdocs_filter_apply "TDOCS_REPL_LIFECYCLE" "${filter_args[@]:1}" "lifecycle"
            return 2
            ;;
        level|l)
            TDOCS_REPL_LEVEL="${filter_args[1]}"
            TDOCS_REPL_DOC_COUNT=0
            echo "Filter: level = ${filter_args[1]}"
            return 2
            ;;
        last:*|recent:*|time:*|date:*)
            TDOCS_REPL_TEMPORAL="${filter_args[0]}"
            TDOCS_REPL_DOC_COUNT=0
            echo "Filter: temporal = ${filter_args[0]}"
            return 2
            ;;
        clear|reset)
            _tdocs_clear_filters
            echo "Filters cleared"
            return 2
            ;;
        *)
            _tdocs_filter_show_help
            ;;
    esac
}

_tdocs_filter_apply() {
    local -n target_array="$1"
    shift
    local spec="$*"
    local label="$1"

    # Replace spaces with commas if not already comma-separated
    if [[ ! "$spec" =~ , ]]; then
        spec="${spec// /,}"
    fi
    IFS=',' read -ra target_array <<< "$spec"
    TDOCS_REPL_DOC_COUNT=0
    echo "Filter: $label = ${target_array[*]}"
}

_tdocs_filter_show_help() {
    cat <<'EOF'
Usage: filter [module|type|intent|lifecycle|level|temporal|clear] <value...>
       filter module rag midi     filter type spec guide
       filter intent define       filter lifecycle C S W
       filter level L3+           filter last:7d
       filter clear               clear all filters

EASIER: Use find command instead!
       find all                   show all documents (reset filters)
       find midi osc              find midi and osc modules
       find spec guide            find specs and guides
       clear                      alias for filter clear

Type: spec guide investigation reference plan summary scratch
Intent: define instruct analyze document propose track
Lifecycle: D (draft) W (working) S (stable) C (canonical) X (archived)
Module: rag midi tdocs repl (or * for all, "" for system)
Level: L0-L4, L3+, L2-L4
Temporal: last:7d last:2w last:1m  recent:week  time:2025-11-01
EOF
}

# =============================================================================
# Clear Filters
# =============================================================================

_tdocs_clear_filters() {
    TDOCS_REPL_MODULES=()
    TDOCS_REPL_TYPE=()
    TDOCS_REPL_INTENT=()
    TDOCS_REPL_LIFECYCLE=()
    TDOCS_REPL_LEVEL=""
    TDOCS_REPL_TEMPORAL=""
    TDOCS_REPL_DOC_COUNT=0
    TDOCS_REPL_STATE="find"
    TDOCS_REPL_SEARCH_QUERY=""
}

# =============================================================================
# Context Handler
# =============================================================================

_tdocs_handle_context() {
    local args="$1"

    if [[ -z "$args" ]]; then
        local ctx_name
        ctx_name=$(tdocs_get_context_display)
        echo "Current context: $TDOCS_REPL_CONTEXT ($ctx_name)"
        echo "Database: $TDOCS_DB_DIR"
        if [[ "$TDOCS_REPL_CONTEXT_LOCKED" == "true" ]]; then
            echo "Status: locked (manual switch)"
        else
            echo "Status: auto-detected"
        fi
    else
        tdocs_switch_context "$args"
        return 2
    fi
}

# =============================================================================
# Levels Help
# =============================================================================

_tdocs_show_levels_help() {
    cat <<'EOF'
Completeness Levels:
  L0 None      No documentation or basic files only
  L1 Minimal   Basic README, minimal docs
  L2 Working   Functional with basic integration
  L3 Complete  Full docs, tests, examples
  L4 Exemplar  Gold standard with specs, full integration

Examples: filter level L3+    filter level L2-L4
EOF
}
