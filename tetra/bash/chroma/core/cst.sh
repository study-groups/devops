#!/usr/bin/env bash

# Chroma CST (Concrete Syntax Tree) Parser
# Parses Markdown into a position-aware syntax tree
#
# Node structure (JSON):
# {
#   "type": "heading",
#   "level": 2,
#   "pos": { "line": 1, "col": 1, "end_col": 15, "offset": 0 },
#   "raw": "## Hello World",
#   "children": [...]
# }

#==============================================================================
# CST STATE
#==============================================================================

declare -g _CST_LINE=0
declare -g _CST_OFFSET=0
declare -g _CST_OUTPUT=""
declare -ga _CST_NODES=()

#==============================================================================
# POSITION HELPERS
#==============================================================================

# Create position object
# Args: line col end_col offset
_cst_pos() {
    local line="$1" col="$2" end_col="$3" offset="$4"
    printf '{"line":%d,"col":%d,"end_col":%d,"offset":%d}' \
        "$line" "$col" "$end_col" "$offset"
}

# Escape string for JSON
_cst_escape() {
    local s="$1"
    s="${s//\\/\\\\}"     # backslash
    s="${s//\"/\\\"}"     # quote
    s="${s//$'\n'/\\n}"   # newline
    s="${s//$'\r'/\\r}"   # carriage return
    s="${s//$'\t'/\\t}"   # tab
    printf '%s' "$s"
}

#==============================================================================
# NODE CONSTRUCTORS
#==============================================================================

# Create a node JSON object
# Args: type raw [extra_fields...]
_cst_node() {
    local type="$1"
    local raw="$2"
    shift 2

    local line="$_CST_LINE"
    local col=1
    local end_col=${#raw}
    local offset="$_CST_OFFSET"

    local escaped_raw=$(_cst_escape "$raw")
    local pos=$(_cst_pos "$line" "$col" "$end_col" "$offset")

    local extra=""
    while [[ $# -gt 0 ]]; do
        extra+=",\"$1\":$2"
        shift 2
    done

    printf '{"type":"%s","pos":%s,"raw":"%s"%s}' \
        "$type" "$pos" "$escaped_raw" "$extra"
}

# Create node with children array
_cst_node_with_children() {
    local type="$1"
    local raw="$2"
    local children="$3"
    shift 3

    local line="$_CST_LINE"
    local col=1
    local end_col=${#raw}
    local offset="$_CST_OFFSET"

    local escaped_raw=$(_cst_escape "$raw")
    local pos=$(_cst_pos "$line" "$col" "$end_col" "$offset")

    local extra=""
    while [[ $# -gt 0 ]]; do
        extra+=",\"$1\":$2"
        shift 2
    done

    printf '{"type":"%s","pos":%s,"raw":"%s","children":[%s]%s}' \
        "$type" "$pos" "$escaped_raw" "$children" "$extra"
}

#==============================================================================
# INLINE PARSER
#==============================================================================

# Parse inline elements from text
# Returns JSON array of inline nodes
_cst_parse_inline() {
    local text="$1"
    local base_col="${2:-1}"
    local nodes=""
    local pos=0
    local len=${#text}

    while (( pos < len )); do
        local char="${text:pos:1}"
        local next="${text:pos+1:1}"
        local remaining="${text:pos}"

        # Code span `...`
        if [[ "$char" == '`' ]]; then
            if [[ "$remaining" =~ ^\`([^\`]+)\` ]]; then
                local content="${BASH_REMATCH[1]}"
                local match="${BASH_REMATCH[0]}"
                local match_len=${#match}

                [[ -n "$nodes" ]] && nodes+=","
                nodes+=$(_cst_inline_node "code" "$match" "$((base_col + pos))" "$match_len" \
                    "content" "\"$(_cst_escape "$content")\"")
                (( pos += match_len ))
                continue
            fi
        fi

        # Bold **...**
        if [[ "$char" == '*' && "$next" == '*' ]]; then
            if [[ "$remaining" =~ ^\*\*([^\*]+)\*\* ]]; then
                local content="${BASH_REMATCH[1]}"
                local match="${BASH_REMATCH[0]}"
                local match_len=${#match}

                [[ -n "$nodes" ]] && nodes+=","
                nodes+=$(_cst_inline_node "bold" "$match" "$((base_col + pos))" "$match_len" \
                    "content" "\"$(_cst_escape "$content")\"")
                (( pos += match_len ))
                continue
            fi
        fi

        # Italic *...*
        if [[ "$char" == '*' && "$next" != '*' ]]; then
            if [[ "$remaining" =~ ^\*([^\*]+)\* ]]; then
                local content="${BASH_REMATCH[1]}"
                local match="${BASH_REMATCH[0]}"
                local match_len=${#match}

                [[ -n "$nodes" ]] && nodes+=","
                nodes+=$(_cst_inline_node "italic" "$match" "$((base_col + pos))" "$match_len" \
                    "content" "\"$(_cst_escape "$content")\"")
                (( pos += match_len ))
                continue
            fi
        fi

        # Link [text](url)
        if [[ "$char" == '[' ]]; then
            if [[ "$remaining" =~ ^\[([^\]]+)\]\(([^\)]+)\) ]]; then
                local link_text="${BASH_REMATCH[1]}"
                local link_url="${BASH_REMATCH[2]}"
                local match="${BASH_REMATCH[0]}"
                local match_len=${#match}

                [[ -n "$nodes" ]] && nodes+=","
                nodes+=$(_cst_inline_node "link" "$match" "$((base_col + pos))" "$match_len" \
                    "text" "\"$(_cst_escape "$link_text")\"" \
                    "url" "\"$(_cst_escape "$link_url")\"")
                (( pos += match_len ))
                continue
            fi
        fi

        # Plain text - collect until next special char
        local plain_text=""
        while (( pos < len )); do
            char="${text:pos:1}"
            [[ "$char" == '`' || "$char" == '*' || "$char" == '[' ]] && break
            plain_text+="$char"
            (( pos++ ))
        done

        if [[ -n "$plain_text" ]]; then
            [[ -n "$nodes" ]] && nodes+=","
            local start_col=$((base_col + pos - ${#plain_text}))
            nodes+=$(_cst_inline_node "text" "$plain_text" "$start_col" "${#plain_text}")
        fi
    done

    printf '%s' "$nodes"
}

# Create inline node
_cst_inline_node() {
    local type="$1"
    local raw="$2"
    local col="$3"
    local len="$4"
    shift 4

    local end_col=$((col + len))
    local escaped_raw=$(_cst_escape "$raw")
    local pos=$(_cst_pos "$_CST_LINE" "$col" "$end_col" "$_CST_OFFSET")

    local extra=""
    while [[ $# -gt 0 ]]; do
        extra+=",\"$1\":$2"
        shift 2
    done

    printf '{"type":"%s","pos":%s,"raw":"%s"%s}' \
        "$type" "$pos" "$escaped_raw" "$extra"
}

#==============================================================================
# BLOCK PARSER
#==============================================================================

# Parse a single line and return node type + data
_cst_parse_block() {
    local line="$1"

    # Empty line
    if [[ -z "$line" ]]; then
        printf '%s' "$(_cst_node "blank" "")"
        return
    fi

    # ATX Heading: # ## ### etc
    if [[ "$line" =~ ^(#{1,6})[[:space:]]+(.*)$ ]]; then
        local hashes="${BASH_REMATCH[1]}"
        local content="${BASH_REMATCH[2]}"
        local level=${#hashes}
        local children=$(_cst_parse_inline "$content" "$((level + 2))")

        printf '%s' "$(_cst_node_with_children "heading" "$line" "$children" \
            "level" "$level")"
        return
    fi

    # Fenced code block start: ```lang
    if [[ "$line" =~ ^\`\`\`(.*)$ ]]; then
        local lang="${BASH_REMATCH[1]}"
        printf '%s' "$(_cst_node "fence_start" "$line" \
            "lang" "\"$(_cst_escape "$lang")\"")"
        return
    fi

    # Horizontal rule: --- or *** or ___
    if [[ "$line" =~ ^[-*_]{3,}[[:space:]]*$ ]]; then
        printf '%s' "$(_cst_node "hr" "$line")"
        return
    fi

    # Blockquote: > text
    if [[ "$line" =~ ^\>[[:space:]]?(.*)$ ]]; then
        local content="${BASH_REMATCH[1]}"
        local children=$(_cst_parse_inline "$content" 3)
        printf '%s' "$(_cst_node_with_children "blockquote" "$line" "$children")"
        return
    fi

    # Unordered list: - item or * item
    if [[ "$line" =~ ^([[:space:]]*)([-*+])[[:space:]]+(.*)$ ]]; then
        local indent="${BASH_REMATCH[1]}"
        local marker="${BASH_REMATCH[2]}"
        local content="${BASH_REMATCH[3]}"
        local indent_level=$(( ${#indent} / 2 ))
        local content_col=$(( ${#indent} + 3 ))

        # Check for checkbox
        local checked="null"
        if [[ "$content" =~ ^\[([ xX])\][[:space:]]+(.*)$ ]]; then
            local check="${BASH_REMATCH[1]}"
            content="${BASH_REMATCH[2]}"
            content_col=$(( content_col + 4 ))
            [[ "$check" == " " ]] && checked="false" || checked="true"
        fi

        local children=$(_cst_parse_inline "$content" "$content_col")
        printf '%s' "$(_cst_node_with_children "list_item" "$line" "$children" \
            "ordered" "false" \
            "indent" "$indent_level" \
            "checked" "$checked")"
        return
    fi

    # Ordered list: 1. item
    if [[ "$line" =~ ^([[:space:]]*)([0-9]+)\.[[:space:]]+(.*)$ ]]; then
        local indent="${BASH_REMATCH[1]}"
        local number="${BASH_REMATCH[2]}"
        local content="${BASH_REMATCH[3]}"
        local indent_level=$(( ${#indent} / 2 ))
        local content_col=$(( ${#indent} + ${#number} + 3 ))
        local children=$(_cst_parse_inline "$content" "$content_col")

        printf '%s' "$(_cst_node_with_children "list_item" "$line" "$children" \
            "ordered" "true" \
            "number" "$number" \
            "indent" "$indent_level")"
        return
    fi

    # Indented code block (4 spaces)
    if [[ "$line" =~ ^[[:space:]]{4}(.*)$ ]]; then
        local content="${BASH_REMATCH[1]}"
        printf '%s' "$(_cst_node "code_indent" "$line" \
            "content" "\"$(_cst_escape "$content")\"")"
        return
    fi

    # Table row: | cell | cell |
    if [[ "$line" =~ ^\|.*\|$ ]]; then
        # Check if separator row: |---|---|
        if [[ "$line" =~ ^\|[-:|[:space:]]+\|$ ]]; then
            local aligns=$(_cst_parse_table_separator "$line")
            printf '%s' "$(_cst_node "table_separator" "$line" \
                "alignments" "[$aligns]")"
            return
        fi
        # Data/header row
        local cells=$(_cst_parse_table_row "$line")
        printf '%s' "$(_cst_node "table_row" "$line" \
            "cells" "[$cells]")"
        return
    fi

    # Default: paragraph text
    local children=$(_cst_parse_inline "$line" 1)
    printf '%s' "$(_cst_node_with_children "paragraph" "$line" "$children")"
}

#==============================================================================
# TABLE PARSING
#==============================================================================

# Parse table separator row to extract alignments
# Input: |:---|:---:|---:|
# Output: "left","center","right"
_cst_parse_table_separator() {
    local line="$1"
    # Remove leading/trailing pipes and split
    line="${line#|}"
    line="${line%|}"

    local aligns=""
    local IFS='|'
    for cell in $line; do
        # Trim whitespace
        cell="${cell#"${cell%%[![:space:]]*}"}"
        cell="${cell%"${cell##*[![:space:]]}"}"

        local align="left"
        if [[ "$cell" =~ ^:-+:$ ]]; then
            align="center"
        elif [[ "$cell" =~ ^-+:$ ]]; then
            align="right"
        elif [[ "$cell" =~ ^:-+$ ]]; then
            align="left"
        fi

        [[ -n "$aligns" ]] && aligns+=","
        aligns+="\"$align\""
    done

    printf '%s' "$aligns"
}

# Parse table row into cells
# Input: | cell 1 | cell 2 |
# Output: cell objects with content
_cst_parse_table_row() {
    local line="$1"
    # Remove leading/trailing pipes
    line="${line#|}"
    line="${line%|}"

    local cells=""
    local col=2  # Start after first |
    local IFS='|'

    for cell in $line; do
        # Trim whitespace for content, keep raw
        local raw="$cell"
        local content="${cell#"${cell%%[![:space:]]*}"}"
        content="${content%"${content##*[![:space:]]}"}"

        local cell_len=${#raw}
        local children=$(_cst_parse_inline "$content" "$col")

        [[ -n "$cells" ]] && cells+=","
        cells+="{\"type\":\"table_cell\",\"pos\":$(_cst_pos "$_CST_LINE" "$col" "$((col + cell_len))" "$_CST_OFFSET"),\"raw\":\"$(_cst_escape "$raw")\",\"content\":\"$(_cst_escape "$content")\",\"children\":[$children]}"

        (( col += cell_len + 1 ))  # +1 for pipe
    done

    printf '%s' "$cells"
}

#==============================================================================
# MAIN PARSER
#==============================================================================

# Parse markdown content into CST
# Input: stdin or file
# Output: JSON CST
chroma_cst_parse() {
    local input="${1:--}"

    # Reset state
    _CST_LINE=0
    _CST_OFFSET=0
    _CST_NODES=()

    local in_fence=0
    local fence_lang=""
    local fence_start_line=0
    local fence_content=""
    local fence_raw=""

    # Table state
    local in_table=0
    local table_start_line=0
    local table_rows=""
    local table_alignments=""
    local table_raw=""

    # Read input
    local content
    if [[ "$input" == "-" ]]; then
        content=$(cat)
    else
        content=$(cat "$input")
    fi

    local nodes=""

    # Helper to flush table
    _flush_table() {
        if (( in_table )); then
            local table_node="{\"type\":\"table\",\"pos\":$(_cst_pos "$table_start_line" 1 "${#table_raw}" 0),\"raw\":\"$(_cst_escape "${table_raw%$'\n'}")\",\"alignments\":[$table_alignments],\"rows\":[$table_rows]}"
            [[ -n "$nodes" ]] && nodes+=","
            nodes+="$table_node"
            in_table=0
            table_rows=""
            table_alignments=""
            table_raw=""
        fi
    }

    while IFS= read -r line || [[ -n "$line" ]]; do
        (( _CST_LINE++ ))

        # Handle fenced code blocks
        if (( in_fence )); then
            fence_raw+="$line"$'\n'
            if [[ "$line" =~ ^\`\`\`[[:space:]]*$ ]]; then
                # End of fence
                local fence_node=$(_cst_node "code_block" "${fence_raw%$'\n'}" \
                    "lang" "\"$(_cst_escape "$fence_lang")\"" \
                    "content" "\"$(_cst_escape "$fence_content")\"" \
                    "start_line" "$fence_start_line")
                [[ -n "$nodes" ]] && nodes+=","
                nodes+="$fence_node"
                in_fence=0
                fence_content=""
                fence_raw=""
            else
                fence_content+="$line"$'\n'
            fi
        elif [[ "$line" =~ ^\`\`\`(.*)$ ]]; then
            _flush_table
            # Start of fence
            in_fence=1
            fence_lang="${BASH_REMATCH[1]}"
            fence_start_line=$_CST_LINE
            fence_raw="$line"$'\n'

        # Handle tables
        elif [[ "$line" =~ ^\|.*\|$ ]]; then
            # Table row
            if (( ! in_table )); then
                in_table=1
                table_start_line=$_CST_LINE
            fi
            table_raw+="$line"$'\n'

            # Check if separator row
            if [[ "$line" =~ ^\|[-:|[:space:]]+\|$ ]]; then
                table_alignments=$(_cst_parse_table_separator "$line")
            else
                local cells=$(_cst_parse_table_row "$line")
                local row_type="body"
                # First row before separator is header
                [[ -z "$table_alignments" ]] && row_type="header"
                [[ -n "$table_rows" ]] && table_rows+=","
                table_rows+="{\"type\":\"table_row\",\"row_type\":\"$row_type\",\"pos\":$(_cst_pos "$_CST_LINE" 1 "${#line}" "$_CST_OFFSET"),\"raw\":\"$(_cst_escape "$line")\",\"cells\":[$cells]}"
            fi
        else
            # Non-table line - flush any pending table
            _flush_table

            # Regular block
            local node=$(_cst_parse_block "$line")
            [[ -n "$nodes" ]] && nodes+=","
            nodes+="$node"
        fi

        (( _CST_OFFSET += ${#line} + 1 ))
    done <<< "$content"

    # Flush any remaining table
    _flush_table

    # Output CST
    printf '{"type":"document","children":[%s]}\n' "$nodes"
}

# Pretty-print CST with jq if available
chroma_cst() {
    local input="${1:--}"
    local raw_json

    raw_json=$(chroma_cst_parse "$input")

    if command -v jq &>/dev/null; then
        echo "$raw_json" | jq .
    else
        echo "$raw_json"
    fi
}

# Functions are local - no exports (TETRA convention)
