tetra-tmux-tetra () 
{ 
    if tmux has-session -t tetra 2> /dev/null; then
        echo "Attaching to the existing 'tetra' session."
        tmux attach-session -t tetra
        return # Exit the function after attaching to avoid creating a new session
    fi

    tmux new-session -d -s tetra
    tmux setw -t tetra mode-keys vi
    tmux split-window -v -t tetra
    tmux select-pane -t tetra:.0
    tmux split-window -h -t tetra
    tmux swap-pane -s tetra:.0 -t tetra:.2
    tmux swap-pane -s tetra:.2 -t tetra:.1

    # Define hosts for panes 1 and 2, defaulting to do1 and do4_n2
    ssh1=${1:-"root@$do1"}
    ssh2=${2:-"root@$do4_n2"}

    # Define arrays for commands in panes 1 and 2
    pane1_commands=(
        "source \$HOME/\$USER.sh"
        "tetra-status"
        "echo use: ssh $ssh1"
    )

    pane2_commands=(
        "source \$HOME/\$USER.sh"
        "tetra-status"
        "echo use: ssh $ssh2"
    )

    pane0_commands=(
        "source $HOME/$USER.sh"
        "tetra-status"
        "echo Tetra Local"
    )

    # Loop through commands for pane 0 and send them thru to tmux
    for cmd in "${pane0_commands[@]}"; do
        tmux send-keys -t 0 "$cmd" C-m
    done
        tmux send-keys -t 0 "echo pane 0" C-m

    # Loop through commands for pane 1 
    for cmd in "${pane1_commands[@]}"; do
        tmux send-keys -t 1 "$cmd" C-m
    done
        tmux send-keys -t 1 "echo pane 1" C-m

    # Loop through commands for pane 2 
    for cmd in "${pane2_commands[@]}"; do
        tmux send-keys -t 2 "$cmd" C-m
    done
        tmux send-keys -t 2 "echo pane 2" C-m

    # Customize status style
    tmux set mouse on
    tmux set status-style fg='#008800'
    tmux set status-style bg='#880088'
    tmux set pane-active-border-style fg=blue
    tmux set pane-border-style fg=gray

    tmux select-pane -t 2
    tmux attach-session -t tetra
    tmux set pane-active-border-style fg=blue
    tmux set pane-border-style fg=gray

}

tetra_tmux_tetra_cmd(){
   local cmd=${2:-"clear"}
   local pane=${1:-"1"}
   echo using pane $pane
   tmux send-keys -t $pane "$cmd" C-m
}

tttc(){
  tetra_tmux_tetra_cmd 0 clear
  tetra_tmux_tetra_cmd 1 clear
  tetra_tmux_tetra_cmd 2 clear
  tetra_tmux_tetra_cmd 0 "echo ttt_help for more" 
}

ttt1(){
  tetra_tmux_tetra_cmd 1 "${@}"
}
ttt2(){
  tetra_tmux_tetra_cmd 2 "${@}"
}

alias ttth='ttt_help'
ttt_help(){
  cat <<EOF
ttt: tetra-tmux-tetra is a collection of functions
     that controls multiple panes of a Tmux
     session started by tetra-tmux-tetra.

tttc: clears all panes
ttt1: execute command in pane1
ttt2: execute command in pane2
ttt{1,2}: tetra-init
EOF
}
