tetra_tmux_set_status(){
  tmux set -g status-left "Line: #(cat /tmp/vim_line)"
}
