#!/usr/bin/env bash
# Interactive fuzzy search for code patterns using ripgrep and fzf

rg --no-heading --with-filename --line-number --color=always "" \
| awk -F: '{printf "%s:%s: %s\n", $1, $2, $3}' \
| fzf --ansi --delimiter ':' --nth=3 \
  --preview 'bat --style=numbers --color=always --highlight-line {2} {1}' \
  --preview-window=right:60%