devops_help(){
  cat << EOF

Source this file to bring devops_ functions into your shell.
The devops_ functions are primarily used to create a custom
user file callded devops.sh which will initiate environment
variables used by tetra.

See tetra/bash/bootstrap.sh for more.

EOF
}

devops_init(){
  TETRA_DIR=$HOME/tetra
  TETRA_SRC=$HOME/src/devops-study-group/tetra/bash/
  echo "Start tetra with"
  echo "TETRA_DIR: $TETRA_DIR"
  echo "TETRA_SRC: $TETRA_SRC"
  echo ctrl-c the quit, return to continue
  read
  source $TETRA_SRC/bootstrap.sh
}

agit(){
  git config --global user.email "userA@gmail.com"
  git config --global user.name "Developer A"
}

bgit(){
  git config --global user.email "userB@hotmail.com"
  git config --global user.name "Developer B"
}

tmux_new(){
  local sessionName="${1:-"untitled-session"}
  local scriptName="${2:-"/dev/null"}
  tmux new-session -d -s "$sessionName" "$scriptName"
}

tmux_list(){
  tmux list-sessions # aka tmux ls
}

# creates session without starting a script
tmux_join(){
  #tmux attach -t $1     
  tmux attach-session -d -t $1 # -d resizes to screen
  # $? is result of attempt to attach
  [ $? == 1 ] && tmux new -s $1 
}

tmux_kill(){
  tmux kill-session -t $1
}

