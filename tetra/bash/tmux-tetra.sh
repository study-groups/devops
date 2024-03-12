tetra-tmux-tetra () 
{ 
    # Check if "tetra" session is already running
    if tmux has-session -t tetra 2>/dev/null; then
        read -p "The 'tetra' session is already running. Do you want to restart it? (y/n): " answer
        if [[ $answer == [Yy]* ]]; then
            tmux kill-session -t tetra
        else
            echo "Exiting without restarting the 'tetra' session."
            return
        fi
    fi

    tmux new-session -d -s tetra

    tmux setw mode-keys vi

    # Split the window into two panes horizontally
    tmux split-window -v

    # Select the first pane and split it vertically
    tmux select-pane -t 0 
    tmux split-window -h

    # Define hosts for panes 1 and 2, defaulting to do1 and do4_n2
    host1=${1:-$do1}
    host2=${2:-$do4_n2}

    # Define arrays for commands in panes 1 and 2
    pane1_commands=(
        "ssh root@$host1"
        "TETRA_SRC=\$HOME/src/devops-study-group/tetra/bash"
        "source \$TETRA_SRC/bootstrap.sh"
        "tetra-status"
    )

    pane2_commands=(
        "ssh root@$host2"
        "source \$HOME/\$USER.sh"
        "tetra-status"
    )

    # Loop through commands for pane 1 and send them
    for cmd in "${pane1_commands[@]}"; do
        tmux send-keys -t 0 "$cmd" C-m
    done

    # Loop through commands for pane 2 and send them
    for cmd in "${pane2_commands[@]}"; do
        tmux send-keys -t 1 "$cmd" C-m
    done

    # Customize status style
    tmux set mouse on
    tmux set status-style fg='#008800'
    tmux set status-style bg='#880088'
    tmux set pane-active-border-style fg=blue
    tmux set pane-border-style fg=gray

    tmux attach-session -t tetra
}
