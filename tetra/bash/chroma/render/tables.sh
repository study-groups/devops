#!/usr/bin/env bash
# Chroma - Table parsing and rendering
# Part of the chroma modular markdown renderer

# Parse table row into cells array
_chroma_parse_table_row() {
    local row="$1"
    local -n cells_ref="$2"
    cells_ref=()

    # Strip leading/trailing pipes and split
    row="${row#|}"
    row="${row%|}"

    # Split by | into cells
    local IFS='|'
    read -ra cells_ref <<< "$row"

    # Trim whitespace from each cell
    local i
    for i in "${!cells_ref[@]}"; do
        cells_ref[$i]="${cells_ref[$i]#"${cells_ref[$i]%%[![:space:]]*}"}"
        cells_ref[$i]="${cells_ref[$i]%"${cells_ref[$i]##*[![:space:]]}"}"
    done
}

# Parse alignment from separator row
_chroma_parse_table_align() {
    local sep="$1"
    local -n aligns_ref="$2"
    aligns_ref=()

    sep="${sep#|}"
    sep="${sep%|}"

    local IFS='|'
    local -a parts
    read -ra parts <<< "$sep"

    local part
    for part in "${parts[@]}"; do
        part="${part#"${part%%[![:space:]]*}"}"
        part="${part%"${part##*[![:space:]]}"}"
        if [[ "$part" =~ ^:.*:$ ]]; then
            aligns_ref+=("center")
        elif [[ "$part" =~ ^: ]]; then
            aligns_ref+=("left")
        elif [[ "$part" =~ :$ ]]; then
            aligns_ref+=("right")
        else
            aligns_ref+=("left")
        fi
    done
}

# Render table row with proper alignment
_chroma_render_table_row() {
    local row="$1"
    local is_header="$2"
    local pad="$3"
    local -n widths_ref="$4"
    local -n aligns_ref="$5"

    local -a cells
    _chroma_parse_table_row "$row" cells

    printf '%s' "$pad"
    _chroma_color "$(_chroma_token table.border)"
    printf '│'
    _chroma_reset

    local i cell width align padl padr
    for i in "${!cells[@]}"; do
        cell="${cells[$i]}"
        width="${widths_ref[$i]:-10}"
        align="${aligns_ref[$i]:-left}"

        # Truncate cell if it exceeds column width
        local visual_len
        visual_len=$(_chroma_visual_width "$cell")
        if (( visual_len > width )); then
            cell=$(_chroma_truncate "$cell" "$width")
            visual_len=$(_chroma_visual_width "$cell")
        fi

        # Calculate padding for alignment (using visual width)
        local total_pad=$((width - visual_len))
        (( total_pad < 0 )) && total_pad=0

        case "$align" in
            center)
                padl=$((total_pad / 2))
                padr=$((total_pad - padl))
                ;;
            right)
                padl=$total_pad
                padr=0
                ;;
            *)  # left
                padl=0
                padr=$total_pad
                ;;
        esac

        printf ' '
        local cell_token
        if (( is_header )); then
            cell_token="table.header"
        else
            cell_token="table.cell"
        fi
        _chroma_color "$(_chroma_token "$cell_token")"
        printf '%*s' "$padl" ''
        _chroma_inline "$cell" "$cell_token"
        printf '%*s' "$padr" ''
        _chroma_reset
        printf ' '
        _chroma_color "$(_chroma_token table.border)"
        printf '│'
        _chroma_reset
    done
    echo
}

# Render table separator line
_chroma_render_table_sep() {
    local pad="$1"
    local -n widths_ref="$2"

    printf '%s' "$pad"
    _chroma_color "$(_chroma_token table.border)"
    printf '├'
    local i width
    for i in "${!widths_ref[@]}"; do
        width="${widths_ref[$i]}"
        printf '%*s' "$((width + 2))" '' | tr ' ' '─'
        if (( i < ${#widths_ref[@]} - 1 )); then
            printf '┼'
        fi
    done
    printf '┤'
    _chroma_reset
    echo
}

# Render table top border
_chroma_render_table_top() {
    local pad="$1"
    local -n widths_ref="$2"

    printf '%s' "$pad"
    _chroma_color "$(_chroma_token table.border)"
    printf '┌'
    local i width
    for i in "${!widths_ref[@]}"; do
        width="${widths_ref[$i]}"
        printf '%*s' "$((width + 2))" '' | tr ' ' '─'
        if (( i < ${#widths_ref[@]} - 1 )); then
            printf '┬'
        fi
    done
    printf '┐'
    _chroma_reset
    echo
}

# Render table bottom border
_chroma_render_table_bottom() {
    local pad="$1"
    local -n widths_ref="$2"

    printf '%s' "$pad"
    _chroma_color "$(_chroma_token table.border)"
    printf '└'
    local i width
    for i in "${!widths_ref[@]}"; do
        width="${widths_ref[$i]}"
        printf '%*s' "$((width + 2))" '' | tr ' ' '─'
        if (( i < ${#widths_ref[@]} - 1 )); then
            printf '┴'
        fi
    done
    printf '┘'
    _chroma_reset
    echo
}

# Truncate text to max width with ellipsis
_chroma_truncate() {
    local text="$1"
    local max_width="$2"

    local visual_len=$(_chroma_visual_width "$text")
    if (( visual_len <= max_width )); then
        echo "$text"
        return
    fi

    # Need to truncate - find cut point
    # Remove formatting markers for accurate length calc
    local plain="${text//\*\*/}"
    plain="${plain//\*/}"
    plain="${plain//\`/}"

    if (( max_width <= 3 )); then
        echo "..."
        return
    fi

    # Cut at max_width - 1 (leave room for ellipsis char)
    local cut_len=$((max_width - 1))
    local result=""
    local i=0
    local in_format=0
    local format_char=""

    # Walk through original text, tracking formatting
    while (( i < ${#text} )); do
        local char="${text:i:1}"
        local next="${text:i+1:1}"

        # Track ** or * or `
        if [[ "$char" == '*' && "$next" == '*' ]]; then
            result+="**"
            ((i+=2))
            continue
        elif [[ "$char" == '*' || "$char" == '`' ]]; then
            result+="$char"
            ((i++))
            continue
        fi

        # Regular character
        result+="$char"
        ((cut_len--))
        ((i++))

        (( cut_len <= 0 )) && break
    done

    echo "${result}…"
}

# Flush accumulated table
_chroma_flush_table() {
    local pad="$1"
    local max_width="${2:-0}"

    (( ${#_CHROMA_TABLE_ROWS[@]} == 0 )) && return

    # Calculate column widths (visual width, not raw)
    _CHROMA_TABLE_WIDTHS=()
    local row cells i num_cols=0
    for row in "${_CHROMA_TABLE_ROWS[@]}"; do
        local -a cells
        _chroma_parse_table_row "$row" cells
        (( ${#cells[@]} > num_cols )) && num_cols=${#cells[@]}
        for i in "${!cells[@]}"; do
            local len
            len=$(_chroma_visual_width "${cells[$i]}")
            if (( len > ${_CHROMA_TABLE_WIDTHS[$i]:-0} )); then
                _CHROMA_TABLE_WIDTHS[$i]=$len
            fi
        done
    done

    # Constrain table to max_width if specified
    if (( max_width > 0 )); then
        local pad_len=${#pad}
        local available=$((max_width - pad_len))

        # Calculate total table width: borders + padding + content
        # Each column: 1 (│) + 1 (space) + content + 1 (space) = content + 3
        # Plus final │ = 1
        local border_overhead=$(( num_cols * 3 + 1 ))
        local content_available=$((available - border_overhead))

        # Sum current widths
        local total_content=0
        for i in "${!_CHROMA_TABLE_WIDTHS[@]}"; do
            total_content=$(( total_content + _CHROMA_TABLE_WIDTHS[$i] ))
        done

        # If too wide, proportionally shrink columns
        if (( total_content > content_available && content_available > 0 )); then
            local min_col_width=5  # Minimum column width
            for i in "${!_CHROMA_TABLE_WIDTHS[@]}"; do
                local old_width=${_CHROMA_TABLE_WIDTHS[$i]}
                local new_width=$(( old_width * content_available / total_content ))
                (( new_width < min_col_width )) && new_width=$min_col_width
                _CHROMA_TABLE_WIDTHS[$i]=$new_width
            done
        fi
    fi

    # Render table
    _chroma_render_table_top "$pad" _CHROMA_TABLE_WIDTHS

    local row_num=0
    for row in "${_CHROMA_TABLE_ROWS[@]}"; do
        if (( row_num == 0 )); then
            _chroma_render_table_row "$row" 1 "$pad" _CHROMA_TABLE_WIDTHS _CHROMA_TABLE_ALIGNS
            _chroma_render_table_sep "$pad" _CHROMA_TABLE_WIDTHS
        else
            _chroma_render_table_row "$row" 0 "$pad" _CHROMA_TABLE_WIDTHS _CHROMA_TABLE_ALIGNS
        fi
        ((row_num++))
    done

    _chroma_render_table_bottom "$pad" _CHROMA_TABLE_WIDTHS

    # Reset table state
    _CHROMA_IN_TABLE=0
    _CHROMA_TABLE_ROWS=()
    _CHROMA_TABLE_ALIGNS=()
    _CHROMA_TABLE_WIDTHS=()
}
