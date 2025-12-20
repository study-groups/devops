#!/usr/bin/env bash

# Chroma CST Renderer
# Walks JSON CST and emits colored terminal output
#
# Usage: chroma_cst_render < cst.json
#        chroma_cst_render file.json
#        echo "# Hello" | chroma_cst_parse | chroma_cst_render

#==============================================================================
# CONFIGURATION
#==============================================================================

# These are set at runtime in chroma_cst_render(), not source time
declare -g _CST_MARGIN=0
declare -g _CST_WIDTH=80
declare -g _CST_MARGIN_STR=""
declare -g _CST_INDENT=0

#==============================================================================
# COLOR HELPERS
#==============================================================================

_cst_color() {
    local token="$1"
    if declare -F tds_text_color &>/dev/null; then
        tds_text_color "$token"
    fi
}

_cst_reset() {
    if declare -F reset_color &>/dev/null; then
        reset_color
    else
        printf '\033[0m'
    fi
}

_cst_bold()   { printf '\033[1m'; }
_cst_italic() { printf '\033[3m'; }
_cst_dim()    { printf '\033[2m'; }

#==============================================================================
# NODE RENDERERS
#==============================================================================

# Dispatch to appropriate renderer based on node type
_cst_render_node() {
    local node="$1"
    local type
    type=$(echo "$node" | jq -r '.type')

    case "$type" in
        document)    _cst_render_document "$node" ;;
        heading)     _cst_render_heading "$node" ;;
        paragraph)   _cst_render_paragraph "$node" ;;
        code_block)  _cst_render_code_block "$node" ;;
        list_item)   _cst_render_list_item "$node" ;;
        blockquote)  _cst_render_blockquote "$node" ;;
        table)       _cst_render_table "$node" ;;
        hr)          _cst_render_hr "$node" ;;
        blank)       _cst_render_blank "$node" ;;
        # Inline types (usually handled by _cst_render_children)
        text)        _cst_render_text "$node" ;;
        bold)        _cst_render_bold "$node" ;;
        italic)      _cst_render_italic "$node" ;;
        code)        _cst_render_inline_code "$node" ;;
        link)        _cst_render_link "$node" ;;
        *)           _cst_render_unknown "$node" ;;
    esac
}

# Render all children of a node
_cst_render_children() {
    local node="$1"
    local children
    children=$(echo "$node" | jq -c '.children // []')

    # Iterate over children array
    echo "$children" | jq -c '.[]' 2>/dev/null | while IFS= read -r child; do
        _cst_render_node "$child"
    done
}

#------------------------------------------------------------------------------
# BLOCK RENDERERS
#------------------------------------------------------------------------------

_cst_render_document() {
    local node="$1"

    # Setup margin string
    (( _CST_MARGIN > 0 )) && printf -v _CST_MARGIN_STR "%*s" "$_CST_MARGIN" ""

    # Top margin
    local top="${TDS_MARGIN_TOP:-0}"
    for ((i=0; i<top; i++)); do echo; done

    # Render children
    _cst_render_children "$node"

    # Bottom margin
    local bottom="${TDS_MARGIN_BOTTOM:-0}"
    for ((i=0; i<bottom; i++)); do echo; done
}

_cst_render_heading() {
    local node="$1"
    local level content
    level=$(echo "$node" | jq -r '.level')

    _cst_color "content.heading.h${level}"
    _cst_bold
    printf "%s" "$_CST_MARGIN_STR"

    # Render inline children (bold, links, etc within heading)
    _cst_render_children "$node"

    _cst_reset
    printf "\n\n"
}

_cst_render_paragraph() {
    local node="$1"

    _cst_color "text.primary"
    printf "%s" "$_CST_MARGIN_STR"

    _cst_render_children "$node"

    _cst_reset
    printf "\n\n"
}

_cst_render_code_block() {
    local node="$1"
    local lang content
    lang=$(echo "$node" | jq -r '.lang // ""')
    content=$(echo "$node" | jq -r '.content // ""')

    # Try bat for syntax highlighting
    if command -v bat &>/dev/null && [[ -n "$lang" ]]; then
        printf "%s\n" "$_CST_MARGIN_STR"
        echo "$content" | bat --style=plain --language="$lang" --color=always 2>/dev/null | \
            sed "s/^/${_CST_MARGIN_STR}    /"
    else
        # Fallback: simple colored output
        _cst_color "content.code.block"
        while IFS= read -r line; do
            printf "%s    %s\n" "$_CST_MARGIN_STR" "$line"
        done <<< "$content"
        _cst_reset
    fi
    printf "\n"
}

_cst_render_list_item() {
    local node="$1"
    local ordered indent checked number
    ordered=$(echo "$node" | jq -r '.ordered')
    indent=$(echo "$node" | jq -r '.indent // 0')
    checked=$(echo "$node" | jq -r '.checked // "null"')
    number=$(echo "$node" | jq -r '.number // 1')

    local indent_str=""
    (( indent > 0 )) && printf -v indent_str "%*s" "$((indent * 2))" ""

    _cst_color "text.primary"
    printf "%s%s" "$_CST_MARGIN_STR" "$indent_str"

    # Bullet/number
    if [[ "$ordered" == "true" ]]; then
        printf "%s. " "$number"
    elif [[ "$checked" == "true" ]]; then
        printf "☑ "
    elif [[ "$checked" == "false" ]]; then
        printf "☐ "
    else
        printf "• "
    fi

    _cst_render_children "$node"
    _cst_reset
    printf "\n"
}

_cst_render_blockquote() {
    local node="$1"

    _cst_color "content.quote"
    printf "%s  │ " "$_CST_MARGIN_STR"
    _cst_render_children "$node"
    _cst_reset
    printf "\n"
}

_cst_render_table() {
    local node="$1"
    local alignments rows

    # Get alignments and rows
    alignments=$(echo "$node" | jq -c '.alignments // []')
    rows=$(echo "$node" | jq -c '.rows // []')

    # Simple table rendering - could be enhanced
    echo "$rows" | jq -c '.[]' | while IFS= read -r row; do
        local row_type
        row_type=$(echo "$row" | jq -r '.row_type // "body"')

        printf "%s" "$_CST_MARGIN_STR"

        [[ "$row_type" == "header" ]] && _cst_bold

        echo "$row" | jq -c '.cells[]' | while IFS= read -r cell; do
            local content
            content=$(echo "$cell" | jq -r '.content // ""')
            printf "│ %-12s " "$content"
        done
        printf "│\n"

        [[ "$row_type" == "header" ]] && {
            _cst_reset
            printf "%s" "$_CST_MARGIN_STR"
            _cst_dim
            printf "├"
            echo "$row" | jq -c '.cells[]' | while IFS= read -r _; do
                printf "──────────────┼"
            done | sed 's/┼$/┤/'
            printf "\n"
            _cst_reset
        }
    done
    printf "\n"
}

_cst_render_hr() {
    local node="$1"
    local width=$((${_CST_WIDTH:-80} - _CST_MARGIN * 2))

    _cst_color "text.secondary"
    printf "%s" "$_CST_MARGIN_STR"
    printf '%*s\n' "$width" '' | tr ' ' '─'
    _cst_reset
    printf "\n"
}

_cst_render_blank() {
    printf "\n"
}

#------------------------------------------------------------------------------
# INLINE RENDERERS
#------------------------------------------------------------------------------

_cst_render_text() {
    local node="$1"
    local content
    content=$(echo "$node" | jq -r '.raw // .content // ""')
    printf "%s" "$content"
}

_cst_render_bold() {
    local node="$1"
    local content
    content=$(echo "$node" | jq -r '.content // ""')

    _cst_bold
    printf "%s" "$content"
    _cst_reset
    _cst_color "text.primary"  # Restore parent color
}

_cst_render_italic() {
    local node="$1"
    local content
    content=$(echo "$node" | jq -r '.content // ""')

    _cst_italic
    printf "%s" "$content"
    _cst_reset
    _cst_color "text.primary"
}

_cst_render_inline_code() {
    local node="$1"
    local content
    content=$(echo "$node" | jq -r '.content // ""')

    _cst_color "content.code.inline"
    printf "%s" "$content"
    _cst_reset
    _cst_color "text.primary"
}

_cst_render_link() {
    local node="$1"
    local text url
    text=$(echo "$node" | jq -r '.text // ""')
    url=$(echo "$node" | jq -r '.url // ""')

    _cst_color "interactive.link"
    # OSC 8 hyperlink (supported by modern terminals)
    printf '\033]8;;%s\033\\%s\033]8;;\033\\' "$url" "$text"
    _cst_reset
    _cst_color "text.primary"
}

_cst_render_unknown() {
    local node="$1"
    local type raw
    type=$(echo "$node" | jq -r '.type')
    raw=$(echo "$node" | jq -r '.raw // ""')

    _cst_dim
    printf "%s[%s: %s]" "$_CST_MARGIN_STR" "$type" "$raw"
    _cst_reset
}

#==============================================================================
# MAIN ENTRY POINT
#==============================================================================

chroma_cst_render() {
    local input="${1:--}"
    local cst

    # Set config at runtime (not source time) so -w flag works
    _CST_MARGIN="${TDS_MARGIN_LEFT:-0}"
    _CST_WIDTH="${TDS_MARKDOWN_WIDTH:-80}"

    if [[ "$input" == "-" ]]; then
        cst=$(cat)
    else
        cst=$(cat "$input")
    fi

    # Validate it's JSON
    if ! echo "$cst" | jq -e . &>/dev/null; then
        echo "Error: Invalid JSON CST" >&2
        return 1
    fi

    _cst_render_node "$cst"
}

#==============================================================================
# PIPELINE HELPER
#==============================================================================

# Full pipeline: markdown → CST → render
chroma_render_via_cst() {
    local input="${1:--}"
    chroma_cst_parse "$input" | chroma_cst_render
}

# Export
export -f chroma_cst_render chroma_render_via_cst
export -f _cst_render_node _cst_render_children
export -f _cst_render_document _cst_render_heading _cst_render_paragraph
export -f _cst_render_code_block _cst_render_list_item _cst_render_blockquote
export -f _cst_render_table _cst_render_hr _cst_render_blank
export -f _cst_render_text _cst_render_bold _cst_render_italic
export -f _cst_render_inline_code _cst_render_link _cst_render_unknown
export -f _cst_color _cst_reset _cst_bold _cst_italic _cst_dim
