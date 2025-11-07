#!/usr/bin/env bash
# Interactive fuzzy search for code patterns using ripgrep and fzf

# Set locale to handle UTF-8 and multibyte characters properly
export LC_ALL="${LC_ALL:-en_US.UTF-8}"
export LANG="${LANG:-en_US.UTF-8}"

# Parse command line options
LAYOUT="right:60%"
while [[ $# -gt 0 ]]; do
  case "$1" in
    -v|--vertical)
      LAYOUT="top:60%"
      shift
      ;;
    -h|--help)
      echo "Usage: fzgrep [OPTIONS]"
      echo ""
      echo "Interactive fuzzy search for code patterns using ripgrep and fzf"
      echo ""
      echo "Options:"
      echo "  -v, --vertical    Start with vertical (top-bottom) layout"
      echo "  -h, --help        Show this help message"
      echo ""
      echo "Key bindings:"
      echo "  ?              Toggle help"
      echo "  Alt-l/v        Preview 70% (big preview)"
      echo "  Shift-Alt-l/v  Preview 60% (balanced)"
      echo "  Ctrl-Shift-l/v Preview 30% (big list)"
      echo "  Alt-p          Toggle preview"
      echo "  Ctrl-o         Open file in editor"
      echo "  Ctrl-y         Copy file:line to clipboard"
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      echo "Use -h or --help for usage information" >&2
      exit 1
      ;;
  esac
done

# Default editor if not set - prefer nvim, fallback to vim
if [[ -z "${EDITOR:-}" ]]; then
  if command -v nvim &>/dev/null; then
    EDITOR=nvim
  else
    EDITOR=vim
  fi
fi

# Get terminal width for intelligent truncation
TERM_WIDTH=$(tput cols 2>/dev/null || echo 80)
# Calculate based on layout - vertical needs less width for paths
if [[ "$LAYOUT" == top:* ]]; then
  MAX_PATH_WIDTH=$((TERM_WIDTH - 20))  # More space in vertical layout
else
  MAX_PATH_WIDTH=$((TERM_WIDTH / 2 - 10))  # Reserve space for line numbers and content
fi

# Create temp files
HELP_FILE=$(mktemp)
HELP_STATE=$(mktemp)
trap "rm -f $HELP_FILE $HELP_STATE" EXIT
echo "code" > "$HELP_STATE"  # Start with code preview visible

# Generate help with TDS colors if available
# Need to source TDS in current shell to get color functions
if [[ -n "${TETRA_SRC:-}" ]] && [[ -f "$TETRA_SRC/bash/tds/tds.sh" ]]; then
  source "$TETRA_SRC/bash/tds/tds.sh" 2>/dev/null
fi

if type tds_color &>/dev/null; then
  # Use TDS colors - execute color functions and write ANSI codes to file
  {
    echo ""
    tds_color "content.heading.h1" "FZGREP HOTKEYS"
    echo ""
    echo ""
    tds_color "content.heading.h2" "SELECTION"
    echo ""
    echo -n "  "
    tds_color "info" "Enter"
    echo "          Exit and show selected file paths"
    echo -n "  "
    tds_color "info" "Tab"
    echo "            Toggle selection (multi-select mode)"
    echo -n "  "
    tds_color "info" "Shift+Tab"
    echo "      Deselect"
    echo ""
    tds_color "content.heading.h2" "NAVIGATION"
    echo ""
    echo -n "  "
    tds_color "info" "↑/↓ or j/k"
    echo "     Move up/down in results"
    echo -n "  "
    tds_color "info" "Shift-↑/↓"
    echo "       Scroll preview up/down"
    echo ""
    tds_color "content.heading.h2" "SEARCH SYNTAX"
    echo -n " "
    tds_color "text.secondary" "(in query field)"
    echo ""
    echo -n "  "
    tds_color "success" "word"
    echo "           Search in filenames AND code content"
    echo -n "  "
    tds_color "warning" "!word"
    echo "          Exclude pattern from results"
    echo -n "  "
    tds_color "warning" "!.sh"
    echo "           Exclude shell files"
    echo -n "  "
    tds_color "content.code.inline" "'word"
    echo "          Exact match (single word)"
    echo -n '  '
    tds_color "content.code.inline" '"exact phrase"'
    echo ' Exact phrase match (with spaces)'
    echo -n "  "
    tds_color "success" "^word"
    echo "          Start with word"
    echo -n "  "
    tds_color "success" "word\$"
    echo "          End with word"
    echo -n "  "
    tds_color "success" "w1 w2"
    echo "          AND - match both w1 and w2"
    echo -n "  "
    tds_color "success" "w1 | w2"
    echo "        OR - match either w1 or w2"
    echo -n "  "
    tds_color "success" "search"
    echo -n " "
    tds_color "warning" "!test"
    echo "   Search but exclude \"test\""
    echo ""
    tds_color "content.heading.h2" "FILENAME-ONLY SEARCH"
    echo -n " "
    tds_color "text.secondary" "(prefix with @)"
    echo ""
    echo -n "  "
    tds_color "interactive.active" "@pattern"
    echo "       Search ONLY in filenames (not content)"
    echo -n "  "
    tds_color "interactive.active" "@test.sh"
    echo "       Find files named test.sh"
    echo -n "  "
    tds_color "interactive.active" '@"my file"'
    echo "     Find files with exact phrase in name"
    echo ""
    tds_color "content.heading.h2" "ACTIONS"
    echo ""
    echo -n "  "
    tds_color "info" "Ctrl-o"
    echo "         Open file in \$EDITOR at line"
    echo -n "  "
    tds_color "info" "Ctrl-y"
    echo "         Copy file:line to clipboard"
    echo ""
    tds_color "content.heading.h2" "VIEW"
    echo ""
    echo -n "  "
    tds_color "info" "?"
    echo "              Toggle this help on/off"
    echo -n "  "
    tds_color "info" "Alt-l"
    echo "          Preview left/right (70% preview)"
    echo -n "  "
    tds_color "info" "Alt-v"
    echo "          Preview top/bottom (70% preview)"
    echo -n "  "
    tds_color "info" "Shift-Alt-l"
    echo "    Preview left/right (60% balanced)"
    echo -n "  "
    tds_color "info" "Shift-Alt-v"
    echo "    Preview top/bottom (60% balanced)"
    echo -n "  "
    tds_color "info" "Ctrl-Shift-l"
    echo "  Preview left/right (30% preview, 70% list)"
    echo -n "  "
    tds_color "info" "Ctrl-Shift-v"
    echo "  Preview top/bottom (30% preview, 70% list)"
    echo -n "  "
    tds_color "info" "Alt-p"
    echo "          Toggle preview on/off"
    echo ""
    tds_color "content.heading.h2" "OTHER"
    echo ""
    echo -n "  "
    tds_color "info" "ESC"
    echo "            Cancel and exit"
    echo ""
    echo ""
    tds_color "text.secondary" "Press ? to return to code preview • Alt-l/v to change layout • Alt-p to hide"
  } > "$HELP_FILE"
else
  # Fallback without TDS
  cat > "$HELP_FILE" << 'HELP_EOF'

FZGREP HOTKEYS

SELECTION
  Enter          Exit and show selected file paths
  Tab            Toggle selection (multi-select mode)
  Shift+Tab      Deselect

NAVIGATION
  ↑/↓ or j/k     Move up/down in results
  Shift-↑/↓      Scroll preview up/down

SEARCH SYNTAX (in query field)
  word           Search in filenames AND code content
  !word          Exclude pattern from results
  !.sh           Exclude shell files
  'word          Exact match (single word)
  "exact phrase" Exact phrase match (with spaces)
  ^word          Start with word
  word$          End with word
  w1 w2          AND - match both w1 and w2
  w1 | w2        OR - match either w1 or w2
  search !test   Search but exclude "test"

FILENAME-ONLY SEARCH (prefix with @)
  @pattern       Search ONLY in filenames (not content)
  @test.sh       Find files named test.sh
  @"my file"     Find files with exact phrase in name

ACTIONS
  Ctrl-o         Open file in $EDITOR at line
  Ctrl-y         Copy file:line to clipboard

VIEW
  ?              Toggle this help on/off
  Alt-l          Preview left/right (70% preview)
  Alt-v          Preview top/bottom (70% preview)
  Shift-Alt-l    Preview left/right (60% balanced)
  Shift-Alt-v    Preview top/bottom (60% balanced)
  Ctrl-Shift-l   Preview left/right (30% preview, 70% list)
  Ctrl-Shift-v   Preview top/bottom (30% preview, 70% list)
  Alt-p          Toggle preview on/off

OTHER
  ESC            Cancel and exit


Press ? to return to code preview • Alt-l/v to change layout • Alt-p to hide
HELP_EOF
fi

# Function to shorten filename with middle ellipsis
# Intelligently truncates paths to fit within max_len while preserving
# the most important parts: filename and both start/end of directory path
shorten_path() {
  local path="$1"
  local max_len="$2"

  # Return as-is if it fits
  if [[ ${#path} -le $max_len ]]; then
    echo "$path"
    return
  fi

  # Always keep the filename (basename) intact if possible
  local basename="${path##*/}"
  local dirname="${path%/*}"

  # If basename itself is too long, truncate it with middle ellipsis
  if [[ ${#basename} -gt $((max_len - 10)) ]]; then
    local keep=$((max_len / 2 - 2))
    echo "${basename:0:$keep}...${basename: -$keep}"
    return
  fi

  # Calculate space available for dirname (account for "/" and "/.../" = 5 chars)
  local dir_space=$((max_len - ${#basename} - 5))

  if [[ $dir_space -lt 8 ]]; then
    # Very limited space - just show ellipsis and basename
    echo ".../$basename"
    return
  fi

  # Split remaining space between start and end of dirname
  local start_len=$((dir_space / 2))
  local end_len=$((dir_space - start_len))

  # Get start and end portions of dirname
  local dir_start="${dirname:0:$start_len}"
  local dir_end="${dirname: -$end_len}"

  # Construct the shortened path with ellipsis in the middle
  echo "${dir_start}...${dir_end}/$basename"
}

# Create preview script that checks state
PREVIEW_SCRIPT=$(mktemp)
trap "rm -f $HELP_FILE $HELP_STATE $PREVIEW_SCRIPT" EXIT

cat > "$PREVIEW_SCRIPT" << 'PREVIEW_EOF'
#!/bin/bash
STATE=$(cat "$HELP_STATE_FILE")
if [[ "$STATE" == "help" ]]; then
  cat "$HELP_FILE_PATH"
else
  FILE="$1"
  LINE="$2"

  # Get full path for display
  FULL_PATH=$(realpath "$FILE" 2>/dev/null || echo "$FILE")

  # Get file stats
  if [[ -f "$FILE" ]]; then
    FILE_SIZE=$(ls -lh "$FILE" 2>/dev/null | awk '{print $5}')
    LINE_COUNT=$(wc -l < "$FILE" 2>/dev/null | tr -d ' ')
  fi

  # Header with file info
  echo -e "\033[1;36m╭─────────────────────────────────────────────────────────────╮\033[0m"
  echo -e "\033[1;36m│\033[0m \033[1;33m📄 File:\033[0m \033[1;32m$FILE\033[0m"
  echo -e "\033[1;36m│\033[0m \033[1;33m📍 Line:\033[0m \033[1;35m$LINE\033[0m / \033[0;37m$LINE_COUNT\033[0m   \033[1;33m📦 Size:\033[0m \033[0;37m$FILE_SIZE\033[0m"
  [[ "$FULL_PATH" != "$FILE" ]] && echo -e "\033[1;36m│\033[0m \033[0;90m$FULL_PATH\033[0m"
  echo -e "\033[1;36m╰─────────────────────────────────────────────────────────────╯\033[0m"
  echo

  # Show code with bat
  if command -v bat &>/dev/null && [[ -f "$FILE" ]]; then
    bat --style=numbers,header --color=always --highlight-line "$LINE" \
        --line-range=$(($LINE > 10 ? $LINE - 10 : 1)): "$FILE" 2>/dev/null || \
        cat -n "$FILE" 2>/dev/null
  else
    # Fallback to awk with line numbers
    awk -v line="$LINE" -v start=$(($LINE > 10 ? $LINE - 10 : 1)) \
      'NR >= start {
        if (NR == line)
          printf "\033[1;33m%4d ▶\033[0m %s\n", NR, $0
        else
          printf "\033[0;37m%4d │\033[0m %s\n", NR, $0
      }' "$FILE"
  fi
fi
PREVIEW_EOF
chmod +x "$PREVIEW_SCRIPT"

# Create toggle help script
TOGGLE_HELP_SCRIPT=$(mktemp)
trap "rm -f $HELP_FILE $HELP_STATE $PREVIEW_SCRIPT $TOGGLE_HELP_SCRIPT" EXIT

cat > "$TOGGLE_HELP_SCRIPT" << 'TOGGLE_EOF'
#!/bin/bash
STATE=$(cat "$HELP_STATE_FILE")
if [[ "$STATE" == "code" ]]; then
  echo "help" > "$HELP_STATE_FILE"
else
  echo "code" > "$HELP_STATE_FILE"
fi
TOGGLE_EOF
chmod +x "$TOGGLE_HELP_SCRIPT"

# Export variables for scripts
export HELP_FILE_PATH="$HELP_FILE"
export HELP_STATE_FILE="$HELP_STATE"
export MAX_PATH_WIDTH

# Pre-process ripgrep output to shorten long filenames
RG_FORMATTER=$(mktemp)
trap "rm -f $HELP_FILE $HELP_STATE $PREVIEW_SCRIPT $TOGGLE_HELP_SCRIPT $RG_FORMATTER" EXIT

cat > "$RG_FORMATTER" << 'FORMATTER_EOF'
#!/bin/bash
# Display shortened paths but keep original path hidden for parsing
# Format: DISPLAY_PATH:LINE:CONTENT|REAL_PATH

while IFS=: read -r file line content; do
  # Just pass through - don't shorten, let fzf handle display
  printf "%s:%s:%s\n" "$file" "$line" "$content"
done
FORMATTER_EOF
chmod +x "$RG_FORMATTER"

# Create reload script for filename-only search mode
RELOAD_SCRIPT=$(mktemp)
trap "rm -f $HELP_FILE $HELP_STATE $PREVIEW_SCRIPT $TOGGLE_HELP_SCRIPT $RG_FORMATTER $RELOAD_SCRIPT" EXIT

cat > "$RELOAD_SCRIPT" << 'RELOAD_EOF'
#!/bin/bash
export LC_ALL="${LC_ALL:-en_US.UTF-8}"
export LANG="${LANG:-en_US.UTF-8}"

QUERY="$1"
# Check if query starts with @ for filename-only search
if [[ "$QUERY" =~ ^@(.+) ]]; then
  PATTERN="${BASH_REMATCH[1]}"
  # Filename-only search: use rg with --files and filter with grep
  rg --files --color=always | grep --color=always -i "$PATTERN" | \
    LC_ALL=C awk '{printf "%s:1:%s\n", $0, $0}'
else
  # Normal content + filename search
  rg --no-heading --with-filename --line-number --color=always "${QUERY:-}" 2>/dev/null | \
    LC_ALL=C awk -F: '{
      file=$1
      line=$2
      # Capture everything after second colon as content
      sub(/^[^:]+:[^:]+:/, "", $0)
      printf "%s:%s:%s\n", file, line, $0
    }'
fi
RELOAD_EOF
chmod +x "$RELOAD_SCRIPT"

# Detect clipboard command
if command -v pbcopy &>/dev/null; then
  CLIPBOARD_CMD="pbcopy"
elif command -v xclip &>/dev/null; then
  CLIPBOARD_CMD="xclip -selection clipboard"
elif command -v wl-copy &>/dev/null; then
  CLIPBOARD_CMD="wl-copy"
else
  CLIPBOARD_CMD="cat"  # Fallback - just print to stdout
fi

# Run search and capture selection
SELECTION=$(rg --no-heading --with-filename --line-number --color=always "" \
| LC_ALL=C awk -F: '{
    file=$1
    line=$2
    # Capture everything after second colon as content
    sub(/^[^:]+:[^:]+:/, "", $0)
    printf "%s:%s:%s\n", file, line, $0
  }' \
| MAX_PATH_WIDTH=$MAX_PATH_WIDTH "$RG_FORMATTER" \
| fzf --ansi --delimiter ':' --multi \
  --layout=reverse \
  --info=inline \
  --prompt="🔍 " \
  --pointer="▶" \
  --marker="✓" \
  --header="?=Help | Alt-l/v=Big+ | Alt-L/V=Swap | Ctrl-L/V=Small+ | Alt-p=Hide | @=Files-only" \
  --bind="change:reload:sleep 0.1; $RELOAD_SCRIPT {q} | MAX_PATH_WIDTH=$MAX_PATH_WIDTH $RG_FORMATTER" \
  --bind="?:execute-silent($TOGGLE_HELP_SCRIPT)+refresh-preview" \
  --bind="alt-l:change-preview-window(right,70%|left,70%)" \
  --bind="alt-v:change-preview-window(bottom,70%|top,70%)" \
  --bind="alt-L:change-preview-window(right,60%|left,60%)" \
  --bind="alt-V:change-preview-window(bottom,60%|top,60%)" \
  --bind="ctrl-L:change-preview-window(right,30%|left,30%)" \
  --bind="ctrl-V:change-preview-window(bottom,30%|top,30%)" \
  --bind="alt-p:toggle-preview" \
  --bind="ctrl-o:execute-silent($EDITOR {1} +{2} </dev/tty >/dev/tty)" \
  --bind="ctrl-y:execute-silent(echo {1}:{2} | $CLIPBOARD_CMD)" \
  --bind="down:down,up:up" \
  --preview="$PREVIEW_SCRIPT {1} {2}" \
  --preview-window="$LAYOUT")

# Output the selection(s) nicely
if [[ -n "$SELECTION" ]]; then
  # Count selections
  SELECTION_COUNT=$(echo "$SELECTION" | wc -l | tr -d ' ')

  echo
  echo -e "\033[1;36m╭─────────────────────────────────────────────────────────────╮\033[0m"
  echo -e "\033[1;36m│\033[0m \033[1;32m✓ Selected $SELECTION_COUNT file(s)\033[0m"
  echo -e "\033[1;36m╰─────────────────────────────────────────────────────────────╯\033[0m"
  echo

  # Process each selected line
  count=0
  while IFS= read -r line; do
    count=$((count + 1))

    # Strip ANSI codes for parsing
    CLEAN_LINE=$(echo "$line" | sed 's/\x1b\[[0-9;]*m//g')

    # Parse fields - file is first field, line number is second
    FILE=$(echo "$CLEAN_LINE" | awk -F: '{print $1}' | xargs)
    LINE_NUM=$(echo "$CLEAN_LINE" | awk -F: '{print $2}' | xargs)
    # Content is everything after second colon
    CONTENT=$(echo "$CLEAN_LINE" | cut -d: -f3-)

    # Get absolute path
    FULLPATH=$(realpath "$FILE" 2>/dev/null || echo "$FILE")

    # Display with number
    echo -e "\033[1;35m[$count]\033[0m \033[1;33m📄\033[0m \033[1;32m$FULLPATH\033[0m:\033[1;35m$LINE_NUM\033[0m"
    echo -e "    \033[0;37m$CONTENT\033[0m"
    echo
  done <<< "$SELECTION"

  echo -e "\033[1;36m─────────────────────────────────────────────────────────────\033[0m"
  echo -e "\033[0;90mTip: Use 'cat', 'grep', or \$EDITOR on the paths above\033[0m"
  echo
fi
