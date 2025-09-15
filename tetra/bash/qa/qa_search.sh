#!/usr/bin/env bash

# QA Search Functions - Interactive search and viewing of QA responses

qa_search() {
  local db="${QA_DIR}/db"
  local query="$*"

  echo "Searching in $db"

  if [[ -z "$query" ]]; then
    echo "Please provide a search term."
    return 1
  fi

  grep -rinH -- "$query" "$db"/*.answer 2>/dev/null | \
    fzf \
      --delimiter : \
      --with-nth 3.. \
      --preview 'echo -e "\033[1;33m{1}\033[0m\n" && batcat --style=numbers --color=always --paging=never {1}' \
      --preview-window=right:80% \
      --bind 'enter:execute(batcat --style=full --paging=always {1})'
}

# Alias for backward compatibility
asearch() { qa_search "$@"; }

qa_browse() {
  local db="${QA_DIR}/db"

  find "$db" -type f -name '*.answer' | \
    fzf \
      --layout=reverse \
      --preview 'batcat --style=numbers --color=always --paging=never {}' \
      --preview-window=up:99% \
      --bind 'h:up,l:down,left:up,right:down' \
      --bind 'enter:execute(batcat --style=full --paging=always {})' \
      --height=100% --border=none --no-mouse
}

qa_browse_glow() {
  local db="${QA_DIR}/db"

  find "$db" -type f -name '*.answer' | \
    fzf \
      --layout=reverse \
      --preview 'glow --style=dark --pager=false {}' \
      --preview-window=up:99%:wrap \
      --bind 'h:up,l:down,left:up,right:down' \
      --bind 'enter:execute(glow --style=dark --pager=true {})' \
      --height=100% --border=none --no-mouse
}
