#!/usr/bin/env bash

# Chroma - Terminal Syntax Highlighter
# Main entry point

#==============================================================================
# CONFIGURATION
#==============================================================================

CHROMA_PAGER_CMD="${CHROMA_PAGER_CMD:-less -R}"
CHROMA_DEBUG="${CHROMA_DEBUG:-0}"

#==============================================================================
# MAIN FUNCTION
#==============================================================================

chroma() {
    # 1. Parse arguments
    chroma_parse_args "$@" || return $?

    # 2. Handle subcommands
    if [[ -n "$CHROMA_SUBCOMMAND" ]]; then
        chroma_dispatch_subcommand "$CHROMA_SUBCOMMAND" "$CHROMA_SUBCMD_ARGS"
        return $?
    fi

    # 3. Resolve input (file or stdin)
    chroma_resolve_input "$CHROMA_FILE" || return $?

    # 4. Auto-detect pager mode
    chroma_auto_pager

    # 5. Detect format
    local format
    format=$(chroma_detect_format "$CHROMA_INPUT_FILE" "$CHROMA_FORMAT")

    # Debug
    (( CHROMA_DEBUG )) && echo "[chroma] file=$CHROMA_INPUT_FILE format=$format pager=$CHROMA_PAGER" >&2

    # 6. Apply margins
    if [[ -n "$CHROMA_MARGIN" ]]; then
        # Uniform override from -m flag
        export TDS_MARGIN_TOP="$CHROMA_MARGIN"
        export TDS_MARGIN_LEFT="$CHROMA_MARGIN"
        export TDS_MARGIN_RIGHT="$CHROMA_MARGIN"
    else
        # Apply defaults
        export TDS_MARGIN_TOP="${CHROMA_MARGIN_TOP:-2}"
        export TDS_MARGIN_LEFT="${CHROMA_MARGIN_LEFT:-4}"
    fi

    # 7. Render
    chroma_render "$format" "$CHROMA_INPUT_FILE" "$CHROMA_PAGER"
    local rc=$?

    # 8. Cleanup
    chroma_cleanup_input

    return $rc
}

#==============================================================================
# STATUS
#==============================================================================

chroma_status() {
    local term_width=${COLUMNS:-$(tput cols 2>/dev/null || echo 80)}
    echo "Chroma Status"
    echo "  TDS loaded: ${TDS_LOADED:-false}"
    echo "  Parsers: ${#CHROMA_PARSER_ORDER[@]} (${CHROMA_PARSER_ORDER[*]})"
    echo "  Pager: ${CHROMA_PAGER_CMD}"
    echo "  Width: ${TDS_MARKDOWN_WIDTH:-auto} (term=$term_width)"
    echo "  Margins: top=${CHROMA_MARGIN_TOP:-2} left=${CHROMA_MARGIN_LEFT:-4}"
}

#==============================================================================
# DIRECT EXECUTION
#==============================================================================

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    chroma "$@"
fi
