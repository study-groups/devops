tetra-tmux-new(){
  local sessionName="${1:-"untitled-session"}
  local scriptName="${2:-"/dev/null"}
  tmux new-session -d -s "$sessionName" "$scriptName"
}

tetra-tmux-list(){
  tmux list-sessions # aka tmux ls
}

# creates session without starting a script
tetra-tmux-join(){
  #tmux attach -t $1     
  tmux attach-session -d -t $1 # -d resizes to screen
  # $? is result of attempt to attach
  [ $? == 1 ] && tmux new -s $1 
}

tetra-tmux-kill(){
  tmux kill-session -t $1
}

tetra-tmux-tetra-kill(){
  tmux kill-session -t tetra 
}

tetra-tmux-tetra(){
  tmux kill-session -t tetra 
  tmux new-session -d -s tetra

  # Split the window into two panes horizontally
  tmux split-window -v

  # Select the first pane and split it vertically
  tmux select-pane -t 0 
  tmux split-window -h

  # Export necessary variables
  export do1
  export do4_n2

  # After SSHing into the first machine
  tmux send-keys -t 0 'ssh root@$do1' C-m
  tmux send-keys -t 0 'clear' C-m

  # After SSHing into the second machine
  tmux send-keys -t 1 'ssh root@$do4_n2' C-m
  tmux send-keys -t 1 'clear' C-m

  tmux send-keys -t 2 'TETRA_SRC=$HOME/src/devops-study-group/tetra/bash' C-m
  tmux send-keys -t 2 'source $TETRA_SRC/bootstrap.sh' C-m
  tmux send-keys -t 2 'tetra-status' C-m
  tmux select-pane -t 2 

  tmux set -g mouse on

  tmux attach-session -t tetra
}
