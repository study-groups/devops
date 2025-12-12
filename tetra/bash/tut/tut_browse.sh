#!/usr/bin/env bash

# TUT Browse - Interactive CLI Tutorial Browser
# Step-by-step navigation through .tut.md files

# State variables
declare -g TUT_CURRENT_STEP=1
declare -g TUT_TOTAL_STEPS=0
declare -g TUT_MD_FILE=""
declare -ga TUT_STEP_LINES=()      # Line numbers where each step starts
declare -ga TUT_STEP_IDS=()        # Step IDs
declare -g TUT_TITLE=""

# Browse a .tut.md file interactively
# Usage: tut_browse <md_file>
tut_browse() {
    local md_file="$1"

    if [[ -z "$md_file" ]]; then
        echo "Error: Markdown file required"
        echo "Usage: tut browse <file.tut.md>"
        return 1
    fi

    # Check generated directory if not found
    if [[ ! -f "$md_file" ]]; then
        if [[ -f "$TUT_DIR/generated/$md_file" ]]; then
            md_file="$TUT_DIR/generated/$md_file"
        elif [[ -f "${md_file%.md}.tut.md" ]]; then
            md_file="${md_file%.md}.tut.md"
        else
            echo "Error: File not found: $md_file"
            return 1
        fi
    fi

    TUT_MD_FILE="$md_file"

    # Parse the file structure
    if ! _tut_parse_structure "$md_file"; then
        echo "Error: Failed to parse tutorial structure"
        return 1
    fi

    # Enter browse loop
    _tut_browse_loop
}

# Parse tutorial structure from markdown
_tut_parse_structure() {
    local md_file="$1"

    TUT_STEP_LINES=()
    TUT_STEP_IDS=()
    TUT_TOTAL_STEPS=0
    TUT_TITLE=""

    local line_num=0
    local in_frontmatter=false

    while IFS= read -r line; do
        ((line_num++))

        # Parse frontmatter
        if [[ "$line" == "---" ]]; then
            if [[ "$in_frontmatter" == false && $line_num -le 2 ]]; then
                in_frontmatter=true
                continue
            else
                in_frontmatter=false
                continue
            fi
        fi

        if [[ "$in_frontmatter" == true ]]; then
            # Extract title from frontmatter
            if [[ "$line" =~ ^title:[[:space:]]*(.+)$ ]]; then
                TUT_TITLE="${BASH_REMATCH[1]}"
            fi
            continue
        fi

        # Find step markers: <!-- TUT:STEP:N:id -->
        if [[ "$line" =~ \<\!--[[:space:]]*TUT:STEP:([0-9]+):([a-z0-9-]+)[[:space:]]*--\> ]]; then
            local step_num="${BASH_REMATCH[1]}"
            local step_id="${BASH_REMATCH[2]}"

            TUT_STEP_LINES+=("$line_num")
            TUT_STEP_IDS+=("$step_id")
            ((TUT_TOTAL_STEPS++))
        fi
    done < "$md_file"

    if [[ $TUT_TOTAL_STEPS -eq 0 ]]; then
        echo "Warning: No step markers found in $md_file"
        echo "Expected format: <!-- TUT:STEP:1:step-id -->"
        return 1
    fi

    return 0
}

# Main browse loop
_tut_browse_loop() {
    TUT_CURRENT_STEP=1

    # Terminal setup
    local old_stty
    old_stty=$(stty -g)

    # Cleanup on exit
    trap '_tut_cleanup_browse "$old_stty"' EXIT INT TERM

    while true; do
        clear
        _tut_render_current_step
        _tut_show_nav_bar

        # Read user input
        read -rsn1 key

        case "$key" in
            n|N|'')  # Next (n, N, or Enter)
                _tut_next_step
                ;;
            p|P)     # Previous
                _tut_prev_step
                ;;
            g|G)     # Goto
                _tut_goto_prompt
                ;;
            q|Q)     # Quit
                break
                ;;
            '?'|h|H) # Help
                _tut_show_help
                ;;
            $'\x1b') # Escape sequence (arrow keys)
                read -rsn2 -t 0.1 arrow
                case "$arrow" in
                    '[C'|'[D')  # Right or Left arrow
                        if [[ "$arrow" == '[C' ]]; then
                            _tut_next_step
                        else
                            _tut_prev_step
                        fi
                        ;;
                esac
                ;;
        esac
    done

    _tut_cleanup_browse "$old_stty"
}

# Cleanup terminal state
_tut_cleanup_browse() {
    local old_stty="$1"
    [[ -n "$old_stty" ]] && stty "$old_stty" 2>/dev/null
    trap - EXIT INT TERM
    echo ""
}

# Navigate to next step
_tut_next_step() {
    if [[ $TUT_CURRENT_STEP -lt $TUT_TOTAL_STEPS ]]; then
        ((TUT_CURRENT_STEP++))
    fi
}

# Navigate to previous step
_tut_prev_step() {
    if [[ $TUT_CURRENT_STEP -gt 1 ]]; then
        ((TUT_CURRENT_STEP--))
    fi
}

# Prompt for step number
_tut_goto_prompt() {
    echo ""
    printf "Go to step (1-%d): " "$TUT_TOTAL_STEPS"
    read -r step_num

    if [[ "$step_num" =~ ^[0-9]+$ ]] && [[ $step_num -ge 1 ]] && [[ $step_num -le $TUT_TOTAL_STEPS ]]; then
        TUT_CURRENT_STEP=$step_num
    else
        echo "Invalid step number"
        sleep 1
    fi
}

# Render the current step
_tut_render_current_step() {
    local start_line=${TUT_STEP_LINES[$((TUT_CURRENT_STEP - 1))]}
    local end_line

    # Determine end line (next step or end of file)
    if [[ $TUT_CURRENT_STEP -lt $TUT_TOTAL_STEPS ]]; then
        end_line=$((${TUT_STEP_LINES[$TUT_CURRENT_STEP]} - 1))
    else
        end_line=$(wc -l < "$TUT_MD_FILE")
    fi

    # Extract step content
    local step_content
    step_content=$(sed -n "${start_line},${end_line}p" "$TUT_MD_FILE")

    # Render header
    _tut_render_header

    echo ""

    # Render content via TDS if available, otherwise plain
    if command -v tds_render_markdown >/dev/null 2>&1; then
        echo "$step_content" | tds_render_markdown -
    elif command -v chroma >/dev/null 2>&1; then
        echo "$step_content" | chroma --no-pager
    else
        # Strip HTML comments for plain rendering
        echo "$step_content" | grep -v '^<!--.*-->$'
    fi
}

# Render tutorial header
_tut_render_header() {
    local term_width=${COLUMNS:-80}
    local title="${TUT_TITLE:-Tutorial}"

    # Title bar
    if command -v tds_text_color >/dev/null 2>&1; then
        tds_text_color "content.heading.h1"
        printf "═══ %s ═══\n" "$title"
        reset_color
    else
        printf "═══ %s ═══\n" "$title"
    fi
}

# Show navigation bar
_tut_show_nav_bar() {
    local term_width=${COLUMNS:-80}

    echo ""

    # Progress indicator
    local progress="Step $TUT_CURRENT_STEP of $TUT_TOTAL_STEPS"
    local step_id="${TUT_STEP_IDS[$((TUT_CURRENT_STEP - 1))]}"

    # Navigation hints
    local nav_hint=""
    if [[ $TUT_CURRENT_STEP -gt 1 ]]; then
        nav_hint+="[p]rev  "
    else
        nav_hint+="        "
    fi

    if [[ $TUT_CURRENT_STEP -lt $TUT_TOTAL_STEPS ]]; then
        nav_hint+="[n]ext  "
    else
        nav_hint+="        "
    fi

    nav_hint+="[g]oto  [?]help  [q]uit"

    # Draw separator and nav
    if command -v tds_text_color >/dev/null 2>&1; then
        tds_text_color "structural.separator"
        printf "%*s\n" "$term_width" "" | tr ' ' '─'

        tds_text_color "text.secondary"
        printf "%s" "$progress"

        tds_text_color "text.muted"
        printf " (%s)" "$step_id"

        # Right-align nav hints
        local left_len=$((${#progress} + ${#step_id} + 3))
        local right_pad=$((term_width - left_len - ${#nav_hint}))
        [[ $right_pad -lt 2 ]] && right_pad=2

        printf "%*s" "$right_pad" ""
        tds_text_color "interactive.link"
        printf "%s\n" "$nav_hint"
        reset_color
    else
        printf "%*s\n" "$term_width" "" | tr ' ' '─'
        printf "%s (%s)%*s%s\n" "$progress" "$step_id" 10 "" "$nav_hint"
    fi
}

# Show help screen
_tut_show_help() {
    clear

    cat <<'EOF'
TUT Browser - Keyboard Commands
================================

Navigation:
  n, Enter, →    Next step
  p, ←           Previous step
  g              Go to step number

Other:
  ?  h           Show this help
  q              Quit browser

Tips:
  - Terminal blocks are syntax highlighted
  - <details> sections can be viewed inline
  - Use chroma to view the full markdown: chroma file.tut.md

EOF

    echo "Press any key to continue..."
    read -rsn1
}

export -f tut_browse
