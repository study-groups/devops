#!/usr/bin/env bash
# Interactive fuzzy search for code patterns using ripgrep and fzf

set -euo pipefail

# Default editor if not set - prefer nvim, fallback to vim
if [[ -z "${EDITOR:-}" ]]; then
  if command -v nvim &>/dev/null; then
    EDITOR=nvim
  else
    EDITOR=vim
  fi
fi

# Create temp help file
HELP_FILE=$(mktemp)
HELP_STATE=$(mktemp)
trap "rm -f $HELP_FILE $HELP_STATE" EXIT
echo "help" > "$HELP_STATE"  # Start with help visible

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
║  PREVIEW                                                             ║
║    Ctrl-h         Toggle help on/off                                ║
║                                                                      ║
║  OTHER                                                               ║
║    ESC            Cancel and exit                                   ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝

Press Ctrl-h to toggle to code preview
HELP_EOF

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
  echo -e "\033[1;36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"
  echo -e "\033[1;33m📄 File:\033[0m \033[1;32m$FILE\033[0m"
  echo -e "\033[1;33m📍 Line:\033[0m \033[1;32m$LINE\033[0m"
  echo -e "\033[1;36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"
  echo
  bat --style=numbers --color=always --highlight-line "$LINE" "$FILE"
fi
PREVIEW_EOF
chmod +x "$PREVIEW_SCRIPT"

# Create toggle script
TOGGLE_SCRIPT=$(mktemp)
trap "rm -f $HELP_FILE $HELP_STATE $PREVIEW_SCRIPT $TOGGLE_SCRIPT" EXIT

cat > "$TOGGLE_SCRIPT" << 'TOGGLE_EOF'
#!/bin/bash
STATE=$(cat "$HELP_STATE_FILE")
if [[ "$STATE" == "code" ]]; then
  echo "help" > "$HELP_STATE_FILE"
else
  echo "code" > "$HELP_STATE_FILE"
fi
TOGGLE_EOF
chmod +x "$TOGGLE_SCRIPT"

# Export variables for scripts
export HELP_FILE_PATH="$HELP_FILE"
export HELP_STATE_FILE="$HELP_STATE"

# Run search and capture selection
SELECTION=$(rg --no-heading --with-filename --line-number --color=always "" \
| awk -F: '{printf "%s:%s: %s\n", $1, $2, $3}' \
| fzf --ansi --delimiter ':' --multi \
  --header="^H=Help | Tab=Select | Enter=Exit | !word=Exclude" \
  --bind="ctrl-h:execute-silent($TOGGLE_SCRIPT)+refresh-preview" \
  --bind="ctrl-o:execute-silent($EDITOR {1} +{2} </dev/tty >/dev/tty)" \
  --bind="ctrl-y:execute-silent(echo {1}:{2} | pbcopy)" \
  --bind="ctrl-d:preview-half-page-down" \
  --bind="ctrl-u:preview-half-page-up" \
  --preview="$PREVIEW_SCRIPT {1} {2}" \
  --preview-window=right:60%)

# Output the selection(s) nicely
if [[ -n "$SELECTION" ]]; then
  echo
  echo -e "\033[1;36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"
  echo -e "\033[1;32m✓ Selected files:\033[0m"
  echo -e "\033[1;36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"
  echo

  # Process each selected line
  while IFS= read -r line; do
    FILE=$(echo "$line" | cut -d: -f1)
    LINE=$(echo "$line" | cut -d: -f2)
    CONTENT=$(echo "$line" | cut -d: -f3-)

    # Get absolute path
    FULLPATH=$(realpath "$FILE" 2>/dev/null || echo "$FILE")

    echo -e "\033[1;33m📄 $FULLPATH:$LINE\033[0m"
    echo -e "   $CONTENT"
    echo
  done <<< "$SELECTION"

  echo -e "\033[1;36m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m"
  echo
fi
