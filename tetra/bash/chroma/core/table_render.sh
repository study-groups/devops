#!/usr/bin/env bash

# Chroma Table Renderer
# Renders tables from CST with proper alignment and borders

#==============================================================================
# TABLE RENDERING
#==============================================================================

# Render a table from CST JSON
# Input: table node JSON via stdin
# Uses jq for JSON parsing
chroma_render_table() {
    local json
    json=$(cat)

    # Check jq is available
    if ! command -v jq &>/dev/null; then
        echo "Error: jq required for table rendering" >&2
        return 1
    fi

    # Extract table data
    local alignments rows
    alignments=$(echo "$json" | jq -r '.alignments // [] | .[]' 2>/dev/null)
    local num_cols=$(echo "$json" | jq -r '.alignments | length' 2>/dev/null)

    # Calculate column widths
    local -a col_widths=()
    local -a align_arr=()

    # Read alignments
    local i=0
    while IFS= read -r align; do
        align_arr+=("$align")
        col_widths+=("0")
        ((i++))
    done <<< "$alignments"

    # Get max width for each column
    local row_count=$(echo "$json" | jq -r '.rows | length')
    for ((r=0; r<row_count; r++)); do
        local cell_count=$(echo "$json" | jq -r ".rows[$r].cells | length")
        for ((c=0; c<cell_count && c<num_cols; c++)); do
            local content=$(echo "$json" | jq -r ".rows[$r].cells[$c].content // \"\"")
            local len=${#content}
            if ((len > col_widths[c])); then
                col_widths[c]=$len
            fi
        done
    done

    # Minimum width of 3
    for ((c=0; c<num_cols; c++)); do
        ((col_widths[c] < 3)) && col_widths[c]=3
    done

    # Render table
    _render_table_border "top" "${col_widths[@]}"

    for ((r=0; r<row_count; r++)); do
        local row_type=$(echo "$json" | jq -r ".rows[$r].row_type // \"body\"")

        # Render row
        printf "│"
        local cell_count=$(echo "$json" | jq -r ".rows[$r].cells | length")
        for ((c=0; c<num_cols; c++)); do
            local content=""
            if ((c < cell_count)); then
                content=$(echo "$json" | jq -r ".rows[$r].cells[$c].content // \"\"")
            fi
            local width=${col_widths[c]}
            local align="${align_arr[c]:-left}"

            # Apply styling for header
            if [[ "$row_type" == "header" ]]; then
                tds_text_color "content.emphasis.bold" 2>/dev/null
                printf "\033[1m"
            fi

            # Pad and align
            _render_cell "$content" "$width" "$align"

            # Reset after header
            if [[ "$row_type" == "header" ]]; then
                printf "\033[0m"
            fi

            printf "│"
        done
        printf "\n"

        # Separator after header
        if [[ "$row_type" == "header" ]]; then
            _render_table_border "middle" "${col_widths[@]}"
        fi
    done

    _render_table_border "bottom" "${col_widths[@]}"
}

# Render a cell with alignment
_render_cell() {
    local content="$1"
    local width="$2"
    local align="$3"

    local len=${#content}
    local padding=$((width - len))

    case "$align" in
        center)
            local left_pad=$((padding / 2))
            local right_pad=$((padding - left_pad))
            printf " %*s%s%*s " "$left_pad" "" "$content" "$right_pad" ""
            ;;
        right)
            printf " %*s%s " "$padding" "" "$content"
            ;;
        *)  # left
            printf " %s%*s " "$content" "$padding" ""
            ;;
    esac
}

# Render table border
_render_table_border() {
    local type="$1"
    shift
    local -a widths=("$@")

    local left middle right line_char
    case "$type" in
        top)
            left="┌" middle="┬" right="┐" line_char="─"
            ;;
        middle)
            left="├" middle="┼" right="┤" line_char="─"
            ;;
        bottom)
            left="└" middle="┴" right="┘" line_char="─"
            ;;
    esac

    printf "%s" "$left"
    local first=1
    for width in "${widths[@]}"; do
        ((first)) || printf "%s" "$middle"
        first=0
        # +2 for padding spaces
        printf "%*s" "$((width + 2))" "" | tr ' ' "$line_char"
    done
    printf "%s\n" "$right"
}

#==============================================================================
# SIMPLE TABLE RENDERING (without jq)
#==============================================================================

# Render table directly from markdown lines
# More efficient for simple cases
chroma_render_table_simple() {
    local -a lines=()
    local -a col_widths=()
    local -a alignments=()
    local header_idx=-1

    # Read all lines
    while IFS= read -r line || [[ -n "$line" ]]; do
        lines+=("$line")
    done

    # First pass: find separator and calculate widths
    local idx=0
    for line in "${lines[@]}"; do
        if [[ "$line" =~ ^\|[-:|[:space:]]+\|$ ]]; then
            header_idx=$idx
            # Parse alignments
            local stripped="${line#|}"
            stripped="${stripped%|}"
            IFS='|' read -ra parts <<< "$stripped"
            for part in "${parts[@]}"; do
                part="${part#"${part%%[![:space:]]*}"}"
                part="${part%"${part##*[![:space:]]}"}"
                if [[ "$part" =~ ^:-+:$ ]]; then
                    alignments+=("center")
                elif [[ "$part" =~ ^-+:$ ]]; then
                    alignments+=("right")
                else
                    alignments+=("left")
                fi
            done
        else
            # Data row - calculate widths
            local stripped="${line#|}"
            stripped="${stripped%|}"
            IFS='|' read -ra cells <<< "$stripped"
            local c=0
            for cell in "${cells[@]}"; do
                cell="${cell#"${cell%%[![:space:]]*}"}"
                cell="${cell%"${cell##*[![:space:]]}"}"
                local len=${#cell}
                if ((c >= ${#col_widths[@]})); then
                    col_widths+=("$len")
                elif ((len > col_widths[c])); then
                    col_widths[c]=$len
                fi
                ((c++))
            done
        fi
        ((idx++))
    done

    # Minimum width
    for ((c=0; c<${#col_widths[@]}; c++)); do
        ((col_widths[c] < 3)) && col_widths[c]=3
    done

    # Render
    _render_table_border "top" "${col_widths[@]}"

    idx=0
    for line in "${lines[@]}"; do
        # Skip separator line
        if ((idx == header_idx)); then
            ((idx++))
            continue
        fi

        local stripped="${line#|}"
        stripped="${stripped%|}"
        IFS='|' read -ra cells <<< "$stripped"

        printf "│"
        local c=0
        for cell in "${cells[@]}"; do
            cell="${cell#"${cell%%[![:space:]]*}"}"
            cell="${cell%"${cell##*[![:space:]]}"}"

            local width=${col_widths[c]:-10}
            local align=${alignments[c]:-left}

            # Header styling
            if ((idx < header_idx || header_idx == -1 && idx == 0)); then
                printf "\033[1m"
            fi

            _render_cell "$cell" "$width" "$align"

            if ((idx < header_idx || header_idx == -1 && idx == 0)); then
                printf "\033[0m"
            fi

            printf "│"
            ((c++))
        done
        printf "\n"

        # Border after header
        if ((idx == header_idx - 1)); then
            _render_table_border "middle" "${col_widths[@]}"
        fi

        ((idx++))
    done

    _render_table_border "bottom" "${col_widths[@]}"
}

export -f chroma_render_table chroma_render_table_simple
export -f _render_cell _render_table_border
