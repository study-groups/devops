#!/usr/bin/env bash

# Chroma Render Dispatch
# Routes to appropriate parser and handles pager

#==============================================================================
# RENDER
#==============================================================================

# Render file with format
# Args: format file use_pager
chroma_render() {
    local format="$1"
    local file="$2"
    local use_pager="$3"

    (( CHROMA_DEBUG )) && echo "[render] format=$format file=$file pager=$use_pager" >&2

    # Get parser function from registry
    local parser_fn
    parser_fn=$(chroma_get_parser "$format")

    (( CHROMA_DEBUG )) && echo "[render] parser_fn=$parser_fn" >&2

    if [[ -z "$parser_fn" ]]; then
        echo "Error: No parser for format '$format'" >&2
        echo "Available: ${CHROMA_PARSER_ORDER[*]}" >&2
        return 1
    fi

    (( CHROMA_DEBUG )) && echo "[render] calling parser with file=$file" >&2

    # Render - pass file path directly to parser
    if (( use_pager )); then
        local -a pager_cmd
        read -ra pager_cmd <<< "${CHROMA_PAGER_CMD:-less -R}"
        "$parser_fn" "$file" | "${pager_cmd[@]}"
    else
        "$parser_fn" "$file"
    fi
}

#==============================================================================
# SUBCOMMAND DISPATCH
#==============================================================================

# Handle subcommands
# Args: subcommand [args...]
# Returns: 0 handled, 1 error
chroma_dispatch_subcommand() {
    local cmd="$1"
    shift
    local -a args
    read -ra args <<< "$*"

    case "$cmd" in
        help)
            chroma_help "${args[@]}"
            ;;
        doctor)
            chroma_doctor "${args[@]}"
            ;;
        status)
            chroma_status
            ;;
        reload)
            chroma_reload
            ;;
        parser|parsers)
            chroma_parser_cmd "${args[@]}"
            ;;
        cst)
            chroma_cst "${args[@]}"
            ;;
        table)
            local input="${args[0]:--}"
            if [[ "$input" == "-" ]]; then
                chroma_render_table_simple
            else
                chroma_render_table_simple < "$input"
            fi
            ;;
        *)
            echo "Unknown subcommand: $cmd" >&2
            return 1
            ;;
    esac
}

# Parser subcommand handler
chroma_parser_cmd() {
    local action="${1:-list}"
    shift 2>/dev/null || true

    case "$action" in
        list|ls)
            chroma_list_parsers
            ;;
        info)
            [[ -z "$1" ]] && { echo "Usage: chroma parser info <name>" >&2; return 1; }
            chroma_parser_info "$1"
            ;;
        *)
            echo "Unknown parser command: $action" >&2
            echo "Try: list, info <name>" >&2
            return 1
            ;;
    esac
}
