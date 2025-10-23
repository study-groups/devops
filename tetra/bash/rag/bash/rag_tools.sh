
rag_png() {
  if ! command -v pngpaste &> /dev/null; then
    echo "pngpaste command not found. Please install pngpaste (e.g., brew install pngpaste)."
    return 1
  fi

  encoded=$(pngpaste - | base64 | tr -d '\n')
  if [[ -z "$encoded" ]]; then
    echo "No image data found in clipboard."
    return 1
  fi

  echo "<img src=\"data:image/png;base64,$encoded\" alt=\"Clipboard Image\" />"
}

# fzgrep is defined in aliases.sh - calls $RAG_CORE_DIR/search/fzfgrep.sh
