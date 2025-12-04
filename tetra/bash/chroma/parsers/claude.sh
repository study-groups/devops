#!/usr/bin/env bash

# Chroma Claude Parser
# Cleans and re-renders Claude Code terminal output
# Fixes: broken tables, inconsistent ANSI coloring, box-drawing visibility

#==============================================================================
# ANSI STRIPPING
#==============================================================================

# Strip all ANSI escape codes from input
_chroma_strip_ansi() {
    sed 's/\x1b\[[0-9;]*m//g'
}

#==============================================================================
# TABLE RECONSTRUCTION
#==============================================================================

# Detect if line starts a table row
_chroma_starts_table_row() {
    local line="$1"
    local trimmed="${line#"${line%%[![:space:]]*}"}"
    [[ "$trimmed" == \|* ]] && return 0
    return 1
}

# Detect if line ends a table row (ends with |)
_chroma_ends_table_row() {
    local line="$1"
    local trimmed="${line%"${line##*[![:space:]]}"}"
    [[ "$trimmed" == *\| ]] && return 0
    return 1
}

# Detect if line is table-related (continuation or partial)
_chroma_is_table_continuation() {
    local line="$1"
    local trimmed="${line#"${line%%[![:space:]]*}"}"
    [[ -z "$trimmed" ]] && return 1

    # Check if line contains | anywhere (potential table content)
    local has_pipe=0
    [[ "$line" == *\|* ]] && has_pipe=1

    # STRONGEST: Line ends with | (possibly with trailing spaces)
    local rtrimmed="${line%"${line##*[![:space:]]}"}"
    if [[ "$rtrimmed" == *\| && "$trimmed" != \|* ]]; then
        return 0
    fi

    # Contains | but doesn't start with | - likely wrapped cell
    if (( has_pipe )) && [[ "$trimmed" != \|* ]]; then
        return 0
    fi

    # Just dashes and pipes - broken separator (no letters)
    if [[ "$trimmed" == *--* ]] && [[ ! "$trimmed" =~ [a-zA-Z] ]]; then
        return 0
    fi

    # Indented text (2+ spaces) without special markers - wrapped content
    if [[ "$line" =~ ^[[:space:]][[:space:]] ]]; then
        [[ "$trimmed" != \|* && "$trimmed" != \#* && ! "$trimmed" =~ ^[-\*•][[:space:]] && "$trimmed" != "---" ]] && return 0
    fi

    return 1
}

# Reconstruct tables by joining wrapped lines
_chroma_reconstruct_tables() {
    local in_table=0
    local -a raw_lines=()
    local -a table_rows=()
    local last_table_end=""  # Track recently output table content for dedup

    # First pass: collect all table-related lines
    while IFS= read -r line || [[ -n "$line" ]]; do
        line="${line%"${line##*[![:space:]]}"}"  # trim trailing ws

        if _chroma_starts_table_row "$line" || \
           { [[ $in_table -eq 1 ]] && _chroma_is_table_continuation "$line"; }; then
            in_table=1
            raw_lines+=("$line")
        else
            # End of table section
            if [[ $in_table -eq 1 && ${#raw_lines[@]} -gt 0 ]]; then
                _chroma_join_table_rows raw_lines table_rows
                _chroma_format_table "${table_rows[@]}"
                # Remember last few rows for dedup
                last_table_end="${table_rows[*]}"
                raw_lines=()
                table_rows=()
                in_table=0
            fi

            # Skip lines that look like orphaned table content after we just output a table
            local trimmed="${line#"${line%%[![:space:]]*}"}"
            if [[ -n "$last_table_end" && "$trimmed" == \|*\| ]]; then
                # This is a table row appearing right after we output a table - skip it
                continue
            fi

            # Clear dedup tracker after non-table content
            [[ "$trimmed" != \|* ]] && last_table_end=""

            printf '%s\n' "$line"
        fi
    done

    # Flush remaining
    if [[ ${#raw_lines[@]} -gt 0 ]]; then
        _chroma_join_table_rows raw_lines table_rows
        _chroma_format_table "${table_rows[@]}"
    fi
}

# Join raw table lines into proper rows based on column count
_chroma_join_table_rows() {
    local -n input_lines=$1
    local -n output_rows=$2
    output_rows=()

    # Find separator row to determine column count
    local num_cols=0
    for line in "${input_lines[@]}"; do
        if [[ "$line" == *---* ]]; then
            # Count | in this line (may be partial)
            local pipes="${line//[^|]/}"
            (( ${#pipes} > num_cols )) && num_cols=${#pipes}
        fi
    done

    # If no separator found, count from first line
    if (( num_cols == 0 )); then
        local first="${input_lines[0]}"
        local pipes="${first//[^|]/}"
        num_cols=${#pipes}
    fi

    # Now join lines until each row has num_cols pipes
    local current_row=""
    local current_pipes=0

    for line in "${input_lines[@]}"; do
        local trimmed="${line#"${line%%[![:space:]]*}"}"

        if [[ "$trimmed" == \|* ]]; then
            # New row starting
            if [[ -n "$current_row" ]]; then
                output_rows+=("$current_row")
            fi
            current_row="$trimmed"
            local p="${trimmed//[^|]/}"
            current_pipes=${#p}
        else
            # Continuation - append
            current_row+=" $trimmed"
            local p="${trimmed//[^|]/}"
            (( current_pipes += ${#p} ))
        fi
    done

    # Save last row
    [[ -n "$current_row" ]] && output_rows+=("$current_row")
}

# Format table with proper column widths - STRICTLY fits to terminal width
_chroma_format_table() {
    local -a rows=("$@")
    local -a col_max=()
    local num_cols=0
    local term_width=${COLUMNS:-$(tput cols 2>/dev/null || echo 80)}

    # First pass: count columns
    for row in "${rows[@]}"; do
        [[ "$row" == *---* && ! "$row" == *[a-zA-Z]* ]] && continue
        local trimmed="${row#|}"
        trimmed="${trimmed%|}"
        IFS='|' read -ra cells <<< "$trimmed"
        (( ${#cells[@]} > num_cols )) && num_cols=${#cells[@]}
    done

    (( num_cols == 0 )) && { printf '%s\n' "${rows[@]}"; return; }

    # Calculate STRICT per-column width to fit terminal
    # Each column: "| " (2) + content + " " (1) = 3 chars overhead
    # Plus final "|" (1)
    local overhead=$(( (num_cols * 3) + 1 ))
    local available=$((term_width - overhead))

    # Ensure minimum usable width
    (( available < num_cols * 4 )) && available=$((num_cols * 4))

    local base_width=$((available / num_cols))

    # Build width array - all columns get equal width for simplicity
    local -a final_widths=()
    for (( i=0; i<num_cols; i++ )); do
        final_widths[$i]=$base_width
    done

    # Give any remainder to first column (Variable names)
    local remainder=$((available - (base_width * num_cols)))
    (( remainder > 0 )) && (( final_widths[0] += remainder ))

    # Output formatted rows
    for row in "${rows[@]}"; do
        # Separator row
        if [[ "$row" == *---* && ! "$row" =~ [a-zA-Z] ]]; then
            printf '|'
            for (( i=0; i<num_cols; i++ )); do
                local w=${final_widths[$i]}
                printf '%*s|' "$((w + 2))" "" | tr ' ' '-'
            done
            printf '\n'
            continue
        fi

        # Data row
        local trimmed="${row#|}"
        trimmed="${trimmed%|}"
        IFS='|' read -ra cells <<< "$trimmed"

        printf '|'
        for (( i=0; i<num_cols; i++ )); do
            local cell="${cells[$i]:-}"
            # Trim whitespace
            cell="${cell#"${cell%%[![:space:]]*}"}"
            cell="${cell%"${cell##*[![:space:]]}"}"

            local max_w=${final_widths[$i]}
            # Truncate with ellipsis if too long
            if (( ${#cell} > max_w )); then
                cell="${cell:0:$((max_w-1))}…"
            fi

            printf ' %-*s |' "$max_w" "$cell"
        done
        printf '\n'
    done
}

#==============================================================================
# RENDERING
#==============================================================================

# Output buffered code block with syntax highlighting
_chroma_output_code_block() {
    local lang="$1"
    local code="$2"
    local c_fence=$(tput setaf 8)
    local c_reset=$(tput sgr0)

    [[ -z "$code" ]] && return

    # Auto-detect language if not specified
    if [[ -z "$lang" || "$lang" == "text" ]]; then
        lang=$(chroma_detect_language "$code")
    fi

    # Output fence with language hint
    printf '%s```%s%s\n' "$c_fence" "$lang" "$c_reset"

    # Highlight and output code
    printf '%s' "$code" | chroma_highlight_code "$lang"

    # Close fence
    printf '%s```%s\n' "$c_fence" "$c_reset"
}

# Render Claude output with TDS colors and syntax highlighting
_chroma_render_claude() {
    local line
    local in_code_block=0
    local code_lang=""
    local code_buffer=""
    local in_unfenced_code=0
    local unfenced_buffer=""

    # Get TDS colors
    local c_reset=$(tput sgr0)
    local c_header=$(tds_text_color header 2>/dev/null || echo "$(tput bold)")
    local c_bullet=$(tds_text_color link 2>/dev/null || echo "$(tput setaf 6)")
    local c_number=$(tds_text_color success 2>/dev/null || echo "$(tput setaf 2)")
    local c_box=$(tds_text_color dim 2>/dev/null || echo "$(tput setaf 8)")
    local c_table=$(tds_text_color normal 2>/dev/null || echo "")
    local c_thinking=$(tds_text_color dim 2>/dev/null || echo "$(tput setaf 5)")
    local c_fence=$(tput setaf 8)

    while IFS= read -r line || [[ -n "$line" ]]; do

        # === FENCED CODE BLOCKS ===
        # Opening fence: ```lang or ```
        if [[ "$line" =~ ^\`\`\`([a-zA-Z0-9_+-]*)$ ]] && (( !in_code_block )); then
            # Flush any unfenced code first
            if (( in_unfenced_code )); then
                _chroma_output_code_block "" "$unfenced_buffer"
                unfenced_buffer=""
                in_unfenced_code=0
            fi

            in_code_block=1
            code_lang="${BASH_REMATCH[1]}"
            code_buffer=""
            continue
        fi

        # Closing fence
        if [[ "$line" =~ ^\`\`\`$ ]] && (( in_code_block )); then
            _chroma_output_code_block "$code_lang" "$code_buffer"
            in_code_block=0
            code_lang=""
            code_buffer=""
            continue
        fi

        # Inside fenced block - accumulate
        if (( in_code_block )); then
            [[ -n "$code_buffer" ]] && code_buffer+=$'\n'
            code_buffer+="$line"
            continue
        fi

        # === UNFENCED CODE DETECTION (disabled - too aggressive) ===
        # Fenced code blocks (```lang) still work above
        # Uncomment to enable unfenced detection:
        # if chroma_looks_like_code "$line" 2>/dev/null; then
        #     in_unfenced_code=1
        #     [[ -n "$unfenced_buffer" ]] && unfenced_buffer+=$'\n'
        #     unfenced_buffer+="$line"
        #     continue
        # fi
        # if (( in_unfenced_code )); then
        #     _chroma_output_code_block "" "$unfenced_buffer"
        #     unfenced_buffer=""
        #     in_unfenced_code=0
        # fi

        # === NON-CODE CONTENT ===

        # Thinking indicator
        if [[ "$line" =~ ^[[:space:]]*∴ ]]; then
            printf '%s%s%s\n' "$c_thinking" "$line" "$c_reset"
            continue
        fi

        # Box-drawing lines (┌ ├ └ │ ─ ┐ ┘ ┤ ┬ ┴ ┼)
        if [[ "$line" =~ [┌┐└┘├┤┬┴┼│─] ]]; then
            printf '%s%s%s\n' "$c_box" "$line" "$c_reset"
            continue
        fi

        # Table separator |---|---|
        if [[ "$line" == \|*-*\| ]]; then
            printf '%s%s%s\n' "$c_table" "$line" "$c_reset"
            continue
        fi

        # Table row (starts and ends with |)
        if [[ "$line" == \|*\| ]]; then
            printf '%s%s%s\n' "$c_table" "$line" "$c_reset"
            continue
        fi

        # Headers (# ##)
        if [[ "$line" =~ ^[[:space:]]*\#+ ]]; then
            printf '%s%s%s\n' "$c_header" "$line" "$c_reset"
            continue
        fi

        # Numbered lists (1. 2. etc)
        if [[ "$line" =~ ^[[:space:]]*[0-9]+\.[[:space:]] ]]; then
            local num="${line%%.*}"
            local rest="${line#*.}"
            printf '%s%s.%s%s\n' "$c_number" "$num" "$c_reset" "$rest"
            continue
        fi

        # Bullet points (• - *)
        if [[ "$line" =~ ^[[:space:]]*[•\-\*][[:space:]] ]]; then
            local indent="${line%%[•\-\*]*}"
            local bullet="${line:${#indent}:1}"
            local rest="${line:$((${#indent}+1))}"
            printf '%s%s%s%s%s\n' "$indent" "$c_bullet" "$bullet" "$c_reset" "$rest"
            continue
        fi

        # Default: normal text
        printf '%s\n' "$line"
    done

    # Flush any remaining code
    if (( in_code_block )); then
        _chroma_output_code_block "$code_lang" "$code_buffer"
    elif (( in_unfenced_code )); then
        _chroma_output_code_block "" "$unfenced_buffer"
    fi
}

#==============================================================================
# MAIN PARSE FUNCTION
#==============================================================================

_chroma_parse_claude() {
    _chroma_strip_ansi | _chroma_reconstruct_tables | _chroma_render_claude
}

#==============================================================================
# VALIDATION
#==============================================================================

_chroma_parse_claude_validate() {
    # Check basic requirements
    command -v sed &>/dev/null || return 1
    command -v tput &>/dev/null || return 1
    return 0
}

#==============================================================================
# INFO
#==============================================================================

_chroma_parse_claude_info() {
    cat <<'EOF'
Cleans and re-renders Claude Code terminal output.

Fixes common issues:
  - Strips inconsistent ANSI escape codes
  - Reconstructs broken/wrapped markdown tables
  - Applies consistent TDS color scheme

Syntax Highlighting:
  - Fenced blocks (```js) use specified language
  - Auto-detects language if not specified
  - Uses bat for highlighting (falls back to basic)

Detected Languages:
  bash, python, javascript, typescript, json, toml, yaml,
  rust, go, c, cpp, java, ruby, php, sql, html, css, xml

Rendering:
  - Box-drawing characters (┌─┐) in dim color
  - Numbered lists (1. 2.) with green numbers
  - Bullet points (• - *) in cyan
  - Tables with proper structure
  - Code blocks with syntax colors
  - Thinking indicator (∴) styled

Usage:
  claude ... | chroma --claude
  pbpaste | chroma --claude
  chroma --claude < saved_output.txt
EOF
}

#==============================================================================
# REGISTRATION
#==============================================================================

chroma_register_parser "claude" "_chroma_parse_claude" "claude ansi" \
    "Claude Code terminal output"
