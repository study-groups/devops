#!/usr/bin/env bash
# tdocs Slash Command Handlers

# Register all tdocs commands
tdocs_register_commands() {
    if ! command -v repl_register_slash_command >/dev/null 2>&1; then
        echo "Error: REPL system not available" >&2
        return 1
    fi

    # Core commands
    repl_register_slash_command "ls" tdocs_cmd_ls
    repl_register_slash_command "view" tdocs_cmd_view
    repl_register_slash_command "search" tdocs_cmd_search
    repl_register_slash_command "tag" tdocs_cmd_tag
    repl_register_slash_command "init" tdocs_cmd_init

    # Context commands
    repl_register_slash_command "filter" tdocs_cmd_filter
    repl_register_slash_command "env" tdocs_cmd_env

    # Utility commands
    repl_register_slash_command "audit" tdocs_cmd_audit
    repl_register_slash_command "discover" tdocs_cmd_discover
    repl_register_slash_command "evidence" tdocs_cmd_evidence
    repl_register_slash_command "about" tdocs_cmd_about
}

# Command: /ls [--core|--other] [--module NAME]
tdocs_cmd_ls() {
    local args=("$@")

    # Apply current filters
    local filter_args=()
    [[ -n "$TDOCS_REPL_CATEGORY" ]] && filter_args+=("--$TDOCS_REPL_CATEGORY")
    [[ -n "$TDOCS_REPL_MODULE" ]] && filter_args+=("--module" "$TDOCS_REPL_MODULE")

    # Merge with provided args
    tdocs_ls_docs "${filter_args[@]}" "${args[@]}"
}

# Command: /view <file>
tdocs_cmd_view() {
    local doc="${1:-}"

    if [[ -z "$doc" ]]; then
        echo "Usage: /view <file>"
        return 1
    fi

    tdocs_view_doc "$doc"
}

# Command: /search <query>
tdocs_cmd_search() {
    local query="${1:-}"

    if [[ -z "$query" ]]; then
        echo "Usage: /search <query>"
        return 1
    fi

    tdocs_search_docs "$query"
}

# Command: /tag <file>
tdocs_cmd_tag() {
    local doc="${1:-}"

    if [[ -z "$doc" ]]; then
        echo "Usage: /tag <file>"
        return 1
    fi

    tdocs_tag_interactive "$doc"
}

# Command: /init <file>
tdocs_cmd_init() {
    local doc="${1:-}"

    if [[ -z "$doc" ]]; then
        echo "Usage: /init <file>"
        return 1
    fi

    shift
    tdocs_init_doc "$doc" "$@"
}

# Command: /filter {core|other|module=NAME|clear}
tdocs_cmd_filter() {
    local filter="${1:-}"

    case "$filter" in
        core)
            TDOCS_REPL_CATEGORY="core"
            echo "Filter: core documents only"
            return 2  # Signal prompt rebuild
            ;;
        other)
            TDOCS_REPL_CATEGORY="other"
            echo "Filter: other documents only"
            return 2
            ;;
        module=*)
            TDOCS_REPL_MODULE="${filter#module=}"
            echo "Filter: module=$TDOCS_REPL_MODULE"
            return 2
            ;;
        clear)
            TDOCS_REPL_CATEGORY=""
            TDOCS_REPL_MODULE=""
            echo "Filters cleared"
            return 2
            ;;
        "")
            # Show current filters
            echo "Current filters:"
            echo "  Category: ${TDOCS_REPL_CATEGORY:-none}"
            echo "  Module: ${TDOCS_REPL_MODULE:-none}"
            return 0
            ;;
        *)
            echo "Usage: /filter {core|other|module=NAME|clear}"
            echo ""
            echo "Options:"
            echo "  core       - Show only core documents"
            echo "  other      - Show only other documents"
            echo "  module=X   - Show only documents from module X"
            echo "  clear      - Clear all filters"
            echo "  (no args)  - Show current filters"
            return 1
            ;;
    esac
}

# Command: /env [toggle|set VALUE]
tdocs_cmd_env() {
    local action="${1:-}"

    # Placeholder for environment context management
    # Could be: dev/prod context, module context, etc.

    case "$action" in
        toggle)
            echo "Environment toggle not yet implemented"
            ;;
        set)
            local value="${2:-}"
            if [[ -z "$value" ]]; then
                echo "Usage: /env set VALUE"
                return 1
            fi
            echo "Setting environment: $value (not yet implemented)"
            ;;
        "")
            echo "Environment context management"
            echo "Usage: /env {toggle|set VALUE}"
            ;;
        *)
            echo "Unknown env action: $action"
            echo "Usage: /env {toggle|set VALUE}"
            return 1
            ;;
    esac
}

# Command: /audit
tdocs_cmd_audit() {
    tdocs_audit_docs "$@"
}

# Command: /discover [--auto-init]
tdocs_cmd_discover() {
    tdocs_discover_docs "$@"
}

# Command: /evidence <query>
tdocs_cmd_evidence() {
    local query="${1:-}"

    if [[ -z "$query" ]]; then
        echo "Usage: /evidence <query>"
        return 1
    fi

    shift
    tdocs_evidence_for_query "$query" "$@"
}

# Command: /about
tdocs_cmd_about() {
    local readme_path="$TDOCS_SRC/docs/README.md"

    if [[ ! -f "$readme_path" ]]; then
        echo "Error: Documentation not found at $readme_path"
        return 1
    fi

    # Check if pager is available
    if command -v less >/dev/null 2>&1; then
        # Use less with color support if available
        if command -v bat >/dev/null 2>&1; then
            bat --style=plain --paging=always "$readme_path"
        else
            less -R "$readme_path"
        fi
    else
        # Fallback to cat
        cat "$readme_path"
    fi
}

export -f tdocs_register_commands
export -f tdocs_cmd_ls
export -f tdocs_cmd_view
export -f tdocs_cmd_search
export -f tdocs_cmd_tag
export -f tdocs_cmd_init
export -f tdocs_cmd_filter
export -f tdocs_cmd_env
export -f tdocs_cmd_audit
export -f tdocs_cmd_discover
export -f tdocs_cmd_evidence
export -f tdocs_cmd_about
