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
  tmux send-keys -t 0 'TETRA_SRC=$HOME/src/devops-study-group/tetra/bash' C-m
  tmux send-keys -t 0 'source $TETRA_SRC/bootstrap.sh' C-m
  tmux send-keys -t 0 'tetra-status' C-m

  # After SSHing into the second machine
  tmux send-keys -t 1 'ssh root@$do4_n2' C-m
  tmux send-keys -t 1 'TETRA_SRC=$HOME/src/devops-study-group/tetra/bash' C-m
  tmux send-keys -t 1 'source $TETRA_SRC/bootstrap.sh' C-m
  tmux send-keys -t 1 'tetra-status' C-m

  tmux send-keys -t 2 'tmux set -g status-style bg=red' C-m
  tmux send-keys -t 2 'TETRA_SRC=$HOME/src/devops-study-group/tetra/bash' C-m
  tmux send-keys -t 2 'source $TETRA_SRC/bootstrap.sh' C-m
  tmux send-keys -t 2 'tetra-status' C-m
  tmux select-pane -t 2 

  tmux set -g mouse on
  tmux set -g status-style bg='#880088'
  tmux set -g pane-active-border-style fg=blue
  tmux set -g pane-border-style fg=grey
  tmux attach-session -t tetra
}
