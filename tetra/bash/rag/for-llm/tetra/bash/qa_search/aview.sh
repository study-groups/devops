aview_glow_preview() {
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

aview_bat_preview() {
  local db="${QA_DIR}/db"

  find "$db" -type f -name '*.answer' | \
    fzf \
      --layout=reverse \
      --preview 'batcat --style=numbers --color=always --paging=never {}' \
      --preview-window=up:99% \
      --bind 'h:up,l:down,left:up,right:down' \
      --bind 'enter:execute(glow --style=dark --pager=true {})' \
      --height=100% --border=none --no-mouse
}

aview_glow_pipe_less() {
  local db="${QA_DIR}/db"

  find "$db" -type f -name '*.answer' | \
    fzf \
      --layout=reverse \
      --preview 'batcat --style=numbers --color=always --paging=never {}' \
      --preview-window=up:99% \
      --bind 'h:up,l:down,left:up,right:down' \
      --bind 'enter:execute(glow --style=dark {} | less -R)' \
      --height=100% --border=none --no-mouse
}
aview_glow_tui() {
  local db="${QA_DIR}/db"

  find "$db" -type f -name '*.answer' | \
    fzf \
      --layout=reverse \
      --height=100% --border=none --no-mouse \
      --bind 'enter:execute(glow --style=dark --pager=true {})'
}

aview_batcat_tui() {
  local db="${QA_DIR}/db"

  find "$db" -type f -name '*.answer' | \
    fzf \
      --layout=reverse \
      --height=100% --border=none --no-mouse \
      --bind 'enter:execute(batcat --style=full --paging=always {})'
}
aview_nvim_tui() {
  local db="${QA_DIR}/db"

  find "$db" -type f -name '*.answer' | \
    fzf \
      --layout=reverse \
      --height=100% --border=none --no-mouse \
      --bind 'enter:execute(nvim -R {})'
}
