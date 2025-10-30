#!/usr/bin/env bash

# TDOC Chuck Actions
# Command routing for chuck subcommands

# Main chuck action router
tdoc_action_chuck() {
    local subcommand="${1:-help}"
    shift

    case "$subcommand" in
        save|s)
            tdoc_action_chuck_save "$@"
            ;;
        list|ls|l)
            tdoc_action_chuck_list "$@"
            ;;
        view|v|cat)
            tdoc_action_chuck_view "$@"
            ;;
        delete|rm|d)
            tdoc_action_chuck_delete "$@"
            ;;
        promote|p)
            tdoc_action_chuck_promote "$@"
            ;;
        search|grep|find)
            tdoc_action_chuck_search "$@"
            ;;
        help|h|--help|-h)
            tdoc_action_chuck_help
            ;;
        *)
            echo "Unknown chuck subcommand: $subcommand" >&2
            echo "Run 'tdoc chuck help' for usage" >&2
            return 1
            ;;
    esac
}

# Action: save
tdoc_action_chuck_save() {
    local kind=""
    local from_file=""
    local interactive=false

    # Parse options
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --from|-f)
                from_file="$2"
                shift 2
                ;;
            --interactive|-i)
                interactive=true
                shift
                ;;
            *)
                if [[ -z "$kind" ]]; then
                    kind="$1"
                fi
                shift
                ;;
        esac
    done

    # Interactive mode: prompt for kind
    if [[ -z "$kind" ]]; then
        read -p "Kind (topic/subject): " kind
        interactive=true
    fi

    if [[ -z "$kind" ]]; then
        echo "Error: kind is required" >&2
        echo "Usage: tdoc chuck save <kind>" >&2
        echo "   or: tdoc chuck save --interactive" >&2
        return 1
    fi

    # Save content
    if [[ -n "$from_file" ]]; then
        if [[ ! -f "$from_file" ]]; then
            echo "Error: file not found: $from_file" >&2
            return 1
        fi
        tdoc_chuck_save "$kind" "$from_file"
    elif [[ "$interactive" == true ]]; then
        echo "Enter/paste content (Ctrl-D when done):"
        echo ""
        tdoc_chuck_save "$kind" "stdin"
    else
        # Read from stdin
        tdoc_chuck_save "$kind" "stdin"
    fi
}

# Action: list
tdoc_action_chuck_list() {
    local kind=""
    local recent=""
    local json=false

    # Parse options
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --kind|-k)
                kind="$2"
                shift 2
                ;;
            --recent|-r)
                recent="$2"
                shift 2
                ;;
            --json|-j)
                json=true
                shift
                ;;
            *)
                shift
                ;;
        esac
    done

    # Build command
    local cmd="tdoc_chuck_list"
    [[ -n "$kind" ]] && cmd="$cmd --kind $kind"
    [[ -n "$recent" ]] && cmd="$cmd --recent $recent"
    [[ "$json" == true ]] && cmd="$cmd --json"

    # Show header (unless json mode)
    if [[ "$json" == false ]]; then
        echo "Chuck Documents"
        echo "==============="
        echo ""
        printf "%-12s %-15s %-20s %s\n" "ID" "KIND" "CREATED" "PREVIEW"
        printf "%-12s %-15s %-20s %s\n" "------------" "---------------" "--------------------" "----------"
    fi

    # Run list command
    eval "$cmd"
}

# Action: view
tdoc_action_chuck_view() {
    local id=""
    local kind=""
    local latest=false
    local no_pager=false

    # Parse options
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --kind|-k)
                kind="$2"
                latest=true
                shift 2
                ;;
            --no-pager|-n)
                no_pager=true
                shift
                ;;
            *)
                if [[ -z "$id" ]]; then
                    id="$1"
                fi
                shift
                ;;
        esac
    done

    if [[ "$latest" == true ]]; then
        if [[ "$no_pager" == true ]]; then
            tdoc_chuck_view --kind "$kind"
        else
            tdoc_chuck_view --kind "$kind" | less -R
        fi
    else
        if [[ -z "$id" ]]; then
            echo "Error: id is required" >&2
            echo "Usage: tdoc chuck view <id>" >&2
            echo "   or: tdoc chuck view --kind <kind>" >&2
            return 1
        fi

        if [[ "$no_pager" == true ]]; then
            tdoc_chuck_view "$id" "$kind"
        else
            tdoc_chuck_view "$id" "$kind" | less -R
        fi
    fi
}

# Action: delete
tdoc_action_chuck_delete() {
    local id="$1"
    local kind="$2"
    local confirm=true

    if [[ "$1" == "--force" || "$1" == "-f" ]]; then
        confirm=false
        id="$2"
        kind="$3"
    fi

    if [[ -z "$id" ]]; then
        echo "Error: id is required" >&2
        echo "Usage: tdoc chuck delete <id> [kind]" >&2
        return 1
    fi

    # Confirm deletion
    if [[ "$confirm" == true ]]; then
        read -p "Delete chuck document $id? (y/N): " answer
        if [[ "$answer" != "y" && "$answer" != "Y" ]]; then
            echo "Cancelled"
            return 0
        fi
    fi

    tdoc_chuck_delete "$id" "$kind"
}

# Action: promote
tdoc_action_chuck_promote() {
    local id="$1"
    local dest_path="$2"

    if [[ -z "$id" || -z "$dest_path" ]]; then
        echo "Error: id and destination path are required" >&2
        echo "Usage: tdoc chuck promote <id> <dest_path>" >&2
        echo ""
        echo "Example: tdoc chuck promote 1729950000 docs/reference/tree-design.md"
        return 1
    fi

    tdoc_chuck_promote "$id" "$dest_path"
}

# Action: search
tdoc_action_chuck_search() {
    local query="$*"

    if [[ -z "$query" ]]; then
        echo "Error: search query is required" >&2
        echo "Usage: tdoc chuck search <query>" >&2
        return 1
    fi

    tdoc_chuck_search "$query"
}

# Action: help
tdoc_action_chuck_help() {
    cat <<'EOF'
tdoc chuck - Capture LLM responses as lower-grade technical documentation

USAGE:
  tdoc chuck <command> [options]

COMMANDS:
  save <kind>           Save LLM response from stdin
    --from <file>       Save from file instead of stdin
    --interactive       Prompt for kind and content

  list                  List all chuck documents
    --kind <kind>       Filter by kind
    --recent <N>        Show only N most recent
    --json              Output as JSON

  view <id>             View chuck document by id
    --kind <kind>       View most recent for kind
    --no-pager          Don't use pager

  delete <id>           Delete chuck document
    --force             Skip confirmation

  promote <id> <dest>   Promote to reference directory

  search <query>        Full-text search across chuck docs

  help                  Show this help

EXAMPLES:
  # Save LLM response
  echo "..." | tdoc chuck save tree

  # List recent chuck docs
  tdoc chuck list --recent 10

  # View specific document
  tdoc chuck view 1729950000

  # Promote to reference
  tdoc chuck promote 1729950000 docs/reference/tree-design.md

  # Search
  tdoc chuck search "boot optimization"

FILES:
  Storage: $TETRA_DIR/tdoc/chuck/
  Format:  {id}.{kind}.md
  ID:      Linux epoch timestamp in seconds

WORKFLOW:
  1. Chuck LLM response: tdoc chuck save <kind>
  2. Review and refine: tdoc chuck view <id>
  3. Promote to reference: tdoc chuck promote <id> <path>
  4. (Optional) Delete chuck: tdoc chuck delete <id>

EOF
}

# Export functions
export -f tdoc_action_chuck
export -f tdoc_action_chuck_save
export -f tdoc_action_chuck_list
export -f tdoc_action_chuck_view
export -f tdoc_action_chuck_delete
export -f tdoc_action_chuck_promote
export -f tdoc_action_chuck_search
export -f tdoc_action_chuck_help
