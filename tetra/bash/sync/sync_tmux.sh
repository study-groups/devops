tetra_sync_tmux_to(){
  scp $HOME/.tmux.conf $1:~/.tmux.conf
}
