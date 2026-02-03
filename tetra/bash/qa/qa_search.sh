#!/usr/bin/env bash

# QA Search Functions - Interactive search and viewing of QA responses

# Viewer: chroma (custom markdown renderer) or raw (plain text)
# Set QA_VIEWER to override: chroma, raw

_qa_get_viewer() {
  # Honor explicit viewer choice
  if [[ -n "$QA_VIEWER" ]]; then
    echo "$QA_VIEWER"
    return
  fi

  # Default to chroma (our custom renderer)
  # Fallback to cat/raw if needed
  echo "chroma"
}

# Legacy alias for backward compatibility
_qa_get_cat_viewer() { _qa_get_viewer; }

# Preview helper for fzf - shows header + content with chroma
# Usage: _qa_preview_answer <answer_file>
_qa_preview_answer() {
  local file="$1"
  local id=$(basename "$file" .answer)
  local db=$(dirname "$file")
  local prompt=""
  [[ -f "$db/$id.prompt" ]] && prompt=$(head -n 1 "$db/$id.prompt")

  # Build output with bracketed header
  {
    echo "[$id: $prompt]"
    echo
    cat "$file"
  } | if declare -f chroma &>/dev/null; then
    chroma -m 2
  elif [[ -f "${CHROMA_SRC:-$TETRA_SRC/bash/chroma}/chroma_modular.sh" ]]; then
    source "${CHROMA_SRC:-$TETRA_SRC/bash/chroma}/chroma_modular.sh"
    chroma -m 2
  else
    cat
  fi
}

qa_search() {
  local db="${QA_DIR}/db"
  local query="$*"
  local viewer=$(_qa_get_viewer)

  echo "Searching in $db (viewer: $viewer)"

  if [[ -z "$query" ]]; then
    echo "Please provide a search term."
    return 1
  fi

  case "$viewer" in
    chroma)
      grep -rinH -- "$query" "$db"/*.answer 2>/dev/null | \
        fzf \
          --delimiter : \
          --with-nth 3.. \
          --preview '_qa_preview_answer {1}' \
          --preview-window=right:80%:wrap \
          --bind "enter:execute(_qa_preview_answer {1} | less -R)"
      ;;
    raw|cat)
      grep -rinH -- "$query" "$db"/*.answer 2>/dev/null | \
        fzf \
          --delimiter : \
          --with-nth 3.. \
          --preview 'cat {1}' \
          --preview-window=right:80% \
          --bind 'enter:execute(less {1})'
      ;;
    *)
      echo "Unknown viewer: $viewer (using raw)" >&2
      grep -rinH -- "$query" "$db"/*.answer 2>/dev/null | \
        fzf \
          --delimiter : \
          --with-nth 3.. \
          --preview 'cat {1}' \
          --preview-window=right:80% \
          --bind 'enter:execute(less {1})'
      ;;
  esac
}

# Alias for backward compatibility
asearch() { qa_search "$@"; }

qa_browse() {
  local db="${QA_DIR}/db"
  local viewer=${1:-$(_qa_get_viewer)}

  echo "Browsing answers with: $viewer (type /help for commands)"

  case "$viewer" in
    chroma)
      find "$db" -type f -name '*.answer' | sort -r | \
        fzf \
          --layout=reverse \
          --preview '_qa_preview_answer {}' \
          --preview-window=up:80%:wrap \
          --bind "enter:execute(_qa_preview_answer {} | less -R)" \
          --bind 'i:execute(less {})' \
          --bind 'r:reload(QA_VIEWER=raw qa browse raw < /dev/tty)' \
          --bind 'q:abort' \
          --header='[chroma] i:info Enter:view r:raw q/Esc/^C:quit' \
          --height=100% --border=none --no-mouse
      ;;
    raw|cat)
      find "$db" -type f -name '*.answer' | sort -r | \
        fzf \
          --layout=reverse \
          --preview 'cat {}' \
          --preview-window=up:80% \
          --bind 'enter:execute(less {})' \
          --bind 'i:execute(less {})' \
          --bind 'c:reload(QA_VIEWER=chroma qa browse chroma < /dev/tty)' \
          --bind 'q:abort' \
          --header='[raw] i:info Enter:view c:chroma q/Esc/^C:quit' \
          --height=100% --border=none --no-mouse
      ;;
    *)
      echo "Unknown viewer: $viewer" >&2
      echo "Use: chroma or raw" >&2
      return 1
      ;;
  esac
}

# Legacy function removed - glow no longer supported

# Browse action functions
qa_browse_help() {
  cat <<'EOF' | less -R

╔══════════════════════════════════════════════════════════════╗
║         QA Browse - Interactive Interface                    ║
╚══════════════════════════════════════════════════════════════╝

NAVIGATION
  Up/Down       Navigate answer list
  Enter         Open answer in full-screen pager
  q, Esc, ^C    Exit browse mode

VIEWER SWITCHING
  r             → Switch to raw (plain text)
  c             → Switch to chroma (from raw mode)

ACTIONS
  i             View file in less (quick info)

VIEWER FEATURES

[chroma] - Default
  • Custom color scheme matching tetra UI
  • Smart heading hierarchy coloring
  • Code block syntax highlighting
  • Automatic line wrapping with fmt
  • Optimized for QA answers
  Keys: i:info r:raw Enter:view q:quit

[raw]
  • Plain text with less pager
  • No dependencies, always works
  • Fast for large files
  Keys: i:info c:chroma Enter:view q:quit

WORKFLOW

1. Browse with chroma (default, best rendering)
2. Use 'r' to switch to raw for plain text
3. Press 'i' anytime for quick view in less
4. Press 'q' to exit

EXAMPLES

  qa browse            → Browse with chroma (default)
  qa browse raw        → Browse with raw viewer

  In browse:
    i                  → Quick view in less
    r                  → Switch to raw
    Enter              → Full view in pager
    q                  → Quit

Press 'q' to exit this help and return to browsing.
EOF
}

qa_browse_delete() {
  local file="$1"
  if [[ -z "$file" ]]; then
    echo "No file selected" >&2
    return 1
  fi

  local id=$(basename "$file" .answer)
  echo "Delete answer $id?"
  echo "File: $file"
  read -p "Confirm (y/N): " confirm

  if [[ "$confirm" =~ ^[Yy]$ ]]; then
    qa_delete "$id"
    echo "Deleted answer $id"
  else
    echo "Cancelled"
  fi
}

qa_browse_export() {
  local file="$1"
  if [[ -z "$file" ]]; then
    echo "No file selected" >&2
    return 1
  fi

  local id=$(basename "$file" .answer)
  local export_file="qa_${id}_export.md"

  echo "Export answer $id to $export_file?"
  read -p "Confirm (y/N): " confirm

  if [[ "$confirm" =~ ^[Yy]$ ]]; then
    {
      echo "# QA Export - $id"
      echo
      echo "## Question"
      echo
      cat "$QA_DIR/db/${id}.prompt" 2>/dev/null || echo "No question found"
      echo
      echo "## Answer"
      echo
      cat "$file"
      echo
      echo "---"
      echo "Exported: $(date)"
    } > "$export_file"
    echo "Exported to: $export_file"
  else
    echo "Cancelled"
  fi
}

qa_browse_copy() {
  local file="$1"
  if [[ -z "$file" ]]; then
    echo "No file selected" >&2
    return 1
  fi

  # Try different clipboard commands
  if command -v pbcopy >/dev/null 2>&1; then
    cat "$file" | pbcopy
    echo "Copied to clipboard (pbcopy)"
  elif command -v xclip >/dev/null 2>&1; then
    cat "$file" | xclip -selection clipboard
    echo "Copied to clipboard (xclip)"
  elif command -v xsel >/dev/null 2>&1; then
    cat "$file" | xsel --clipboard
    echo "Copied to clipboard (xsel)"
  else
    echo "No clipboard command found (pbcopy, xclip, xsel)" >&2
    return 1
  fi
}

qa_browse_info() {
  local file="$1"
  if [[ -z "$file" ]]; then
    echo "No file selected" >&2
    return 1
  fi

  local id=$(basename "$file" .answer)
  local prompt_file="$QA_DIR/db/${id}.prompt"
  local data_file="$QA_DIR/db/${id}.data"
  local response_file="$QA_DIR/db/${id}.response"

  cat <<EOF | less -R

Answer Information
==================

ID: $id
Answer file: $file
Size: $(wc -c < "$file") bytes
Lines: $(wc -l < "$file") lines

Question:
---------
$(cat "$prompt_file" 2>/dev/null || echo "No question found")

Metadata:
---------
Created: $(date -r "$file" 2>/dev/null || stat -f %Sm "$file" 2>/dev/null || echo "Unknown")

Files:
------
$(ls -lh "$QA_DIR/db/${id}".* 2>/dev/null | awk '{print $9, $5}')

Press 'q' to exit.
EOF
}
