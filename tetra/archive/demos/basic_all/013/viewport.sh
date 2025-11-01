#!/usr/bin/env bash

# Viewport Management - Tight control over header/content/footer layout
# Ensures header stays fixed, content is bounded

# Viewport state
declare -g VIEWPORT_TERM_HEIGHT=0
declare -g VIEWPORT_TERM_WIDTH=0
declare -g VIEWPORT_HEADER_LINES=4
declare -g VIEWPORT_FOOTER_LINES=2
declare -g VIEWPORT_CONTENT_LINES=0
declare -g VIEWPORT_RAW_CONTENT=""

# Update terminal dimensions
update_viewport_dimensions() {
    # Get current terminal size
    VIEWPORT_TERM_HEIGHT=${LINES:-$(tput lines 2>/dev/null || echo 24)}
    VIEWPORT_TERM_WIDTH=${COLUMNS:-$(tput cols 2>/dev/null || echo 80)}

    # Calculate available content space
    # Header + Footer + 2 separator lines
    local reserved=$((VIEWPORT_HEADER_LINES + VIEWPORT_FOOTER_LINES + 2))
    VIEWPORT_CONTENT_LINES=$((VIEWPORT_TERM_HEIGHT - reserved))

    # Ensure minimum content area
    [[ $VIEWPORT_CONTENT_LINES -lt 5 ]] && VIEWPORT_CONTENT_LINES=5
}

# Count actual lines in rendered content
count_content_lines() {
    local content="$1"
    echo "$content" | wc -l
}

# Store raw content (called before truncation)
store_raw_content() {
    VIEWPORT_RAW_CONTENT="$1"
}

# Truncate content to fit viewport (simple version with pager hint)
truncate_content() {
    local content="$1"
    local max_lines="$VIEWPORT_CONTENT_LINES"

    local actual_lines=$(count_content_lines "$content")

    if (( actual_lines <= max_lines )); then
        # Fits - return as is
        echo "$content"
    else
        # Too long - truncate and add pager hint
        local content_lines=$((max_lines - 1))
        local truncated=$(echo "$content" | head -n "$content_lines")
        local more_lines=$((actual_lines - content_lines))

        # Return content + pager hint
        echo "$truncated"
        printf "\033[2m[%d more lines... total: %d | Press Ctrl+O to view all]\033[0m\n" "$more_lines" "$actual_lines"
    fi
}

# Detect available pager (prefer glow for markdown, fallback to less)
detect_pager() {
    if command -v glow &>/dev/null; then
        echo "glow --pager"
    elif command -v less &>/dev/null; then
        echo "less -R"
    elif command -v more &>/dev/null; then
        echo "more"
    else
        echo "cat"
    fi
}

# Open full content in pager
view_in_pager() {
    local content="$VIEWPORT_RAW_CONTENT"

    # DEBUG: Log to file
    echo "[$(date '+%H:%M:%S')] view_in_pager called" >> /tmp/pager_debug.log
    echo "[$(date '+%H:%M:%S')] Content length: ${#content}" >> /tmp/pager_debug.log

    if [[ -z "$content" ]]; then
        echo "[$(date '+%H:%M:%S')] ERROR: Content is empty!" >> /tmp/pager_debug.log
        # Show error to user in TUI
        clear
        echo "ERROR: No content to display in pager"
        echo "VIEWPORT_RAW_CONTENT is empty"
        echo ""
        echo "Press any key to return..."
        read -n1
        return 1
    fi

    local pager=$(detect_pager)
    echo "[$(date '+%H:%M:%S')] Using pager: $pager" >> /tmp/pager_debug.log

    # Create temp file (glow works better with files than pipes)
    local tmpfile="/tmp/tui_pager_$$.md"
    echo "$content" > "$tmpfile"
    echo "[$(date '+%H:%M:%S')] Wrote $(wc -l < "$tmpfile") lines to $tmpfile" >> /tmp/pager_debug.log

    # Clear screen and show pager
    clear
    $pager "$tmpfile"
    local exit_code=$?

    # Cleanup
    rm -f "$tmpfile"

    echo "[$(date '+%H:%M:%S')] Pager exited with code: $exit_code" >> /tmp/pager_debug.log

    return 0
}

# Get content window (for scrolling future enhancement)
get_content_window() {
    local content="$1"
    local scroll_offset="${VIEWPORT_CONTENT_SCROLL:-0}"
    local window_size="$VIEWPORT_CONTENT_LINES"

    # Extract lines from scroll_offset to scroll_offset+window_size
    echo "$content" | tail -n +$((scroll_offset + 1)) | head -n "$window_size"
}

# Render with viewport constraints
render_with_viewport() {
    local header_func="$1"
    local content_func="$2"
    local footer_func="$3"

    # Update dimensions
    update_viewport_dimensions

    # Position cursor at top-left
    printf '\033[H'

    # Render header (fixed height)
    eval "$header_func"

    # Render content (bounded)
    local raw_content=$(eval "$content_func")
    local bounded_content=$(truncate_content "$raw_content")
    echo "$bounded_content"

    # Move to bottom for footer
    local footer_row=$((VIEWPORT_TERM_HEIGHT - VIEWPORT_FOOTER_LINES + 1))
    printf '\033[%d;1H' "$footer_row"

    # Render footer
    eval "$footer_func"
}

# Clear viewport (alternative to full clear)
clear_viewport() {
    update_viewport_dimensions

    # Clear from top to bottom
    printf '\033[H\033[J'
}

# Show viewport debug info
show_viewport_info() {
    cat <<EOF
Viewport Info:
  Terminal: ${VIEWPORT_TERM_HEIGHT}×${VIEWPORT_TERM_WIDTH}
  Header: ${VIEWPORT_HEADER_LINES} lines
  Content: ${VIEWPORT_CONTENT_LINES} lines
  Footer: ${VIEWPORT_FOOTER_LINES} lines
  Scroll: ${VIEWPORT_CONTENT_SCROLL}
EOF
}
