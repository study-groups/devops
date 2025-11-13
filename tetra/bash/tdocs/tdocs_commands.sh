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
    repl_register_slash_command "add" tdocs_cmd_add

    # Context commands
    repl_register_slash_command "filter" tdocs_cmd_filter
    repl_register_slash_command "env" tdocs_cmd_env

    # Utility commands
    repl_register_slash_command "audit" tdocs_cmd_audit
    repl_register_slash_command "scan" tdocs_cmd_scan
    repl_register_slash_command "evidence" tdocs_cmd_evidence
    repl_register_slash_command "about" tdocs_cmd_about
    repl_register_slash_command "colors" tdocs_cmd_colors

    # Module commands
    repl_register_slash_command "module" tdocs_cmd_module
    repl_register_slash_command "spec" tdocs_cmd_spec
    repl_register_slash_command "audit-specs" tdocs_cmd_audit_specs

    # Publishing commands
    repl_register_slash_command "publish" tdocs_cmd_publish
    repl_register_slash_command "nginx-config" tdocs_cmd_nginx_config
    repl_register_slash_command "publish-targets" tdocs_cmd_publish_targets
}

# Command: /ls [--core|--other] [--module NAME]
tdocs_cmd_ls() {
    local args=("$@")
    local detailed=false
    local numbered=true  # Always show numbers for selection

    # Check for -l flag (detailed view)
    local filtered_args=()
    for arg in "${args[@]}"; do
        if [[ "$arg" == "-l" ]]; then
            detailed=true
        else
            filtered_args+=("$arg")
        fi
    done

    # Apply current filters (from new array-based filters)
    local filter_args=()

    # Module filters (join with comma)
    if [[ ${#TDOCS_REPL_MODULES[@]} -gt 0 ]]; then
        local module_list=$(IFS=','; echo "${TDOCS_REPL_MODULES[*]}")
        filter_args+=("--module" "$module_list")
    fi

    # Type filters (join with comma)
    if [[ ${#TDOCS_REPL_TYPE[@]} -gt 0 ]]; then
        local type_list=$(IFS=','; echo "${TDOCS_REPL_TYPE[*]}")
        filter_args+=("--type" "$type_list")
    fi

    # Intent filters (join with comma)
    if [[ ${#TDOCS_REPL_INTENT[@]} -gt 0 ]]; then
        local intent_list=$(IFS=','; echo "${TDOCS_REPL_INTENT[*]}")
        filter_args+=("--intent" "$intent_list")
    fi

    # Lifecycle filters (join with comma)
    if [[ ${#TDOCS_REPL_LIFECYCLE[@]} -gt 0 ]]; then
        local lifecycle_list=$(IFS=','; echo "${TDOCS_REPL_LIFECYCLE[*]}")
        filter_args+=("--lifecycle" "$lifecycle_list")
    fi

    # Level filter (optional)
    [[ -n "$TDOCS_REPL_LEVEL" ]] && filter_args+=("--level" "$TDOCS_REPL_LEVEL")

    # Temporal filter
    [[ -n "$TDOCS_REPL_TEMPORAL" ]] && filter_args+=("--temporal" "$TDOCS_REPL_TEMPORAL")

    # Add mode flags
    [[ "$detailed" == true ]] && filter_args+=("--detailed")
    filter_args+=("--numbered")  # Always numbered in REPL

    # Merge with provided args
    tdocs_ls_docs "${filter_args[@]}" "${filtered_args[@]}"

    # Exit search mode when listing
    TDOCS_REPL_STATE="find"
    TDOCS_REPL_SEARCH_QUERY=""
}

# Command: /view <file|number>
tdocs_cmd_view() {
    local doc="${1:-}"

    if [[ -z "$doc" ]]; then
        echo "Usage: /view <file|number>"
        echo "  /view 3         View document #3 from last ls"
        echo "  /view README.md View specific file"
        return 1
    fi

    # Check if it's a number (index from last ls)
    if [[ "$doc" =~ ^[0-9]+$ ]]; then
        # Get document by index from last list
        local index=$((doc - 1))  # Convert to 0-based
        if [[ -n "${TDOCS_LAST_LIST[$index]}" ]]; then
            tdocs_view_doc "${TDOCS_LAST_LIST[$index]}" --pager
        else
            echo "Error: No document at index $doc"
            echo "Run 'ls' first to see available documents"
            return 1
        fi
    else
        tdocs_view_doc "$doc" --pager
    fi
}

# Command: /search <query>
tdocs_cmd_search() {
    local query="${1:-}"

    if [[ -z "$query" ]]; then
        echo "Usage: /search <query>"
        return 1
    fi

    tdocs_search_docs "$query"

    # Update REPL state to reflect search mode
    TDOCS_REPL_STATE="search"
    TDOCS_REPL_SEARCH_QUERY="$query"
    TDOCS_REPL_DOC_COUNT=${#TDOCS_LAST_LIST[@]}

    return 2  # Signal prompt rebuild
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

# Command: /add <file>
tdocs_cmd_add() {
    local doc="${1:-}"

    if [[ -z "$doc" ]]; then
        echo "Usage: add <file>"
        echo "  Add metadata to a document with smart defaults"
        return 1
    fi

    shift
    tdocs_add_doc "$doc" "$@"
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

# Command: /scan [--dry-run]
tdocs_cmd_scan() {
    tdocs_scan_docs "$@"
}

# Command: /doctor [--fix|--summary]
tdocs_cmd_doctor() {
    tdocs_doctor "$@"
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
    # Just delegate to the main tdocs_about function with pager enabled
    tdocs_about "$@"
}

# Command: /module <name>
tdocs_cmd_module() {
    local module_name="${1:-}"

    if [[ -z "$module_name" ]]; then
        echo "Usage: module <module_name>"
        return 0  # Don't exit REPL
    fi

    tdoc_module_docs "$module_name"
}

# Command: /spec <module>
tdocs_cmd_spec() {
    local module_name="${1:-}"

    if [[ -z "$module_name" ]]; then
        echo "Usage: spec <module_name>"
        return 0  # Don't exit REPL
    fi

    tdoc_show_spec "$module_name"
}

# Command: /audit-specs [--missing]
tdocs_cmd_audit_specs() {
    tdoc_audit_specs "$@"
}

# Command: /colors [subcommand] [args]
tdocs_cmd_colors() {
    if [[ $# -eq 0 ]]; then
        # Show help by default
        tdocs_color_explorer help
    else
        # Forward all arguments to color explorer
        tdocs_color_explorer "$@"
    fi
}

# Command: /publish [source] [target]
tdocs_cmd_publish() {
    local source_path="${1:-.}"
    local target="${2:-docs}"

    if [[ "$source_path" == "--help" ]] || [[ "$source_path" == "-h" ]]; then
        echo "Usage: publish [source] [target]"
        echo ""
        echo "Arguments:"
        echo "  source  - Source directory to publish (default: current directory)"
        echo "  target  - Publish target from tetra.toml (default: docs)"
        echo ""
        echo "Examples:"
        echo "  publish . docs           - Publish current dir to publish.docs"
        echo "  publish ./api docs.api   - Publish ./api to publish.docs.api"
        echo ""
        echo "See available targets: publish-targets"
        return 0
    fi

    tdocs_publish "$source_path" "$target"
}

# Command: /nginx-config [target]
tdocs_cmd_nginx_config() {
    local target="${1:-docs}"

    if [[ "$target" == "--help" ]] || [[ "$target" == "-h" ]]; then
        echo "Usage: nginx-config [target]"
        echo ""
        echo "Generate nginx proxy configuration for a publish target"
        echo ""
        echo "Arguments:"
        echo "  target  - Publish target from tetra.toml (default: docs)"
        echo ""
        echo "Examples:"
        echo "  nginx-config docs       - Generate config for publish.docs"
        echo "  nginx-config docs.api   - Generate config for publish.docs.api"
        echo ""
        echo "Output can be piped directly to a file:"
        echo "  nginx-config docs | sudo tee /etc/nginx/sites-available/my-domain"
        return 0
    fi

    tdocs_generate_nginx_config "$target"
}

# Command: /publish-targets
tdocs_cmd_publish_targets() {
    tdocs_list_publish_targets
}

export -f tdocs_register_commands
export -f tdocs_cmd_ls
export -f tdocs_cmd_view
export -f tdocs_cmd_search
export -f tdocs_cmd_tag
export -f tdocs_cmd_add
export -f tdocs_cmd_filter
export -f tdocs_cmd_env
export -f tdocs_cmd_audit
export -f tdocs_cmd_scan
export -f tdocs_cmd_doctor
export -f tdocs_cmd_evidence
export -f tdocs_cmd_about
export -f tdocs_cmd_module
export -f tdocs_cmd_spec
export -f tdocs_cmd_audit_specs
export -f tdocs_cmd_colors
export -f tdocs_cmd_publish
export -f tdocs_cmd_nginx_config
export -f tdocs_cmd_publish_targets
