tetra_tmux_new(){
  local sessionName="${1:-"untitled-session"}"
  local scriptName="${2:-"/dev/null"}"
  tmux new-session -d -s "$sessionName" "$scriptName"
}

tetra_tmux_list(){
  tmux list-sessions # aka tmux ls
}

tetra_tmux_join ()
{
    tmux has-session -t tetra 2>/dev/null &&  \
    tmux attach-session -t $1 || \
    tmux new-session -s $1
}

tetra_tmux_kill_session(){
  tmux kill-session -t $1
}

tetra_tmux_kill_server(){
  echo "Will kill everything tmux."
  tmux list-sessions
  read -p "Sure? ctrl-c to exit."
  tmux kill-server
}

tetra_tmux_load_conf(){
  local confFile="$TETRA_SRC/tetra.tmux.conf"
  tmux source-file "$confFile"
}
