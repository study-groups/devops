tetra-tmux-tetra () 
{ 
    # Check if "tetra" session is already running
    if tmux has-session -t tetra 2>/dev/null; then
        read -p "Tetra already running. Restart? (y/n): " answer
        if [[ $answer == [Yy]* ]]; then
            tmux kill-session -t tetra
        else
            echo "Exiting without restarting the 'tetra' session."
            return
        fi
    fi

    tmux new-session -d -s tetra
    tmux setw mode-keys vi
    tmux split-window -v               # Step 4: Split the top pane vertically
    tmux select-pane -t 0              # Step 3: Select the top pane
    tmux split-window -h               # Step 2: Split the initial pane horizontally
    tmux swap-pane -s 0 -t 2  # Swap Pane 0 (bottom) with Pane 2 (top right)
    tmux swap-pane -s 2 -t 1  # Swap Pane 2 (now at bottom) with Pane 1 (top left)

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
tttk: kills the server
ttt1: execute command in pane1
ttt2: execute command in pane2
ttt{1,2}: tetra-init
EOF
}
