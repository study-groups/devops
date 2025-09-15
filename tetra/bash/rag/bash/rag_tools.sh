
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

fzgrep() {
rg --no-heading --with-filename --line-number --color=always "" \
| awk -F: '{printf "%s:%s: %s\n", $1, $2, $3}' \
| fzf --ansi --delimiter ':' --nth=3 \
  --preview 'bat --style=numbers --color=always --highlight-line {2} {1}' \
  --preview-window=right:60%
}
