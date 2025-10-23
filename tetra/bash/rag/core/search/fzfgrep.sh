#!/usr/bin/env bash
# Interactive fuzzy search for code patterns using ripgrep and fzf

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
MAX_PATH_WIDTH=$((TERM_WIDTH / 2 - 10))  # Reserve space for line numbers and content

# Create temp files
HELP_FILE=$(mktemp)
HELP_STATE=$(mktemp)
trap "rm -f $HELP_FILE $HELP_STATE" EXIT
echo "code" > "$HELP_STATE"  # Start with code preview visible

cat > "$HELP_FILE" << 'HELP_EOF'
╔══════════════════════════════════════════════════════════════════════╗
║                         FZGREP HOTKEYS                               ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║  SELECTION                                                           ║
║    Enter          Exit and show selected file paths                 ║
║    Tab            Toggle selection (multi-select mode)              ║
║    Shift+Tab      Deselect                                          ║
║                                                                      ║
║  NAVIGATION                                                          ║
║    ↑/↓ or j/k     Move up/down in results                          ║
║    Ctrl-d/u       Scroll preview half-page down/up                 ║
║                                                                      ║
║  SEARCH SYNTAX (in query field)                                      ║
║    word           Search in filenames AND code content              ║
║    !word          Exclude pattern from results                      ║
║    !.sh           Exclude shell files                               ║
║    'word          Exact match                                       ║
║    ^word          Start with word                                   ║
║    word$          End with word                                     ║
║    w1 w2          AND - match both w1 and w2                        ║
║    w1 | w2        OR - match either w1 or w2                        ║
║    search !test   Search but exclude "test"                         ║
║                                                                      ║
║  ACTIONS                                                             ║
║    Ctrl-o         Open file in $EDITOR at line                      ║
║    Ctrl-y         Copy file:line to clipboard                       ║
║                                                                      ║
║  VIEW                                                                ║
║    ?              Toggle this help on/off                           ║
║    Alt-l          Toggle preview left/right                         ║
║    Alt-v          Toggle preview top/bottom                         ║
║    Alt-p          Toggle preview on/off                             ║
║                                                                      ║
║  OTHER                                                               ║
║    ESC            Cancel and exit                                   ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝

Press ? to return to code preview • Alt-l/v to change layout • Alt-p to hide
HELP_EOF

# Function to shorten filename with middle ellipsis
shorten_path() {
  local path="$1"
  local max_len="$2"

  if [[ ${#path} -le $max_len ]]; then
    echo "$path"
    return
  fi

  # Favor keeping the filename (basename)
  local basename="${path##*/}"
  local dirname="${path%/*}"

  # If basename itself is too long, truncate it
  if [[ ${#basename} -gt $((max_len - 10)) ]]; then
    local keep=$((max_len / 2 - 3))
    echo "${basename:0:$keep}...${basename: -$keep}"
    return
  fi

  # Calculate space for dirname
  local dir_space=$((max_len - ${#basename} - 4))  # 4 for "/.../"

  if [[ $dir_space -lt 5 ]]; then
    # Not enough space, just show basename with ellipsis
    echo ".../$basename"
  else
    # Show beginning of path with ellipsis
    echo "${dirname:0:$dir_space}.../$basename"
  fi
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
  if command -v bat &>/dev/null; then
    bat --style=numbers,header --color=always --highlight-line "$LINE" \
        --line-range=$(($LINE > 10 ? $LINE - 10 : 1)): "$FILE"
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
shorten_path() {
  local path="$1"
  local max_len="${MAX_PATH_WIDTH:-40}"

  if [[ ${#path} -le $max_len ]]; then
    echo "$path"
    return
  fi

  local basename="${path##*/}"
  local dirname="${path%/*}"

  if [[ ${#basename} -gt $((max_len - 10)) ]]; then
    local keep=$((max_len / 2 - 3))
    echo "${basename:0:$keep}...${basename: -$keep}"
    return
  fi

  local dir_space=$((max_len - ${#basename} - 4))
  if [[ $dir_space -lt 5 ]]; then
    echo ".../$basename"
  else
    echo "${dirname:0:$dir_space}.../$basename"
  fi
}

while IFS=: read -r file line content; do
  short_file=$(shorten_path "$file")
  printf "\033[36m%-${MAX_PATH_WIDTH}s\033[0m:\033[33m%4s\033[0m: %s\n" "$short_file" "$line" "$content"
done
FORMATTER_EOF
chmod +x "$RG_FORMATTER"

# Run search and capture selection
SELECTION=$(rg --no-heading --with-filename --line-number --color=always "" \
| awk -F: '{
    file=$1
    line=$2
    # Capture everything after second colon as content
    sub(/^[^:]+:[^:]+:/, "", $0)
    printf "%s:%s:%s\n", file, line, $0
  }' \
| MAX_PATH_WIDTH=$MAX_PATH_WIDTH "$RG_FORMATTER" \
| fzf --ansi --delimiter ':' --multi \
  --info=inline \
  --prompt="🔍 " \
  --pointer="▶" \
  --marker="✓" \
  --header="?=Help | Alt-l/v=Layout | Alt-p=Hide | Tab=Select | Enter=Done" \
  --bind="?:execute-silent($TOGGLE_HELP_SCRIPT)+refresh-preview" \
  --bind="alt-l:change-preview-window(left,60%|right,60%)" \
  --bind="alt-v:change-preview-window(top,60%|bottom,60%)" \
  --bind="alt-p:toggle-preview" \
  --bind="ctrl-o:execute-silent($EDITOR {1} +{2} </dev/tty >/dev/tty)" \
  --bind="ctrl-y:execute-silent(echo {1}:{2} | pbcopy)" \
  --preview="$PREVIEW_SCRIPT {1} {2}" \
  --preview-window=right:60%)

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
  local count=0
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
