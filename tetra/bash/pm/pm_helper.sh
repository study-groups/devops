tetra_pm_show_main_buffer() {
    # Capture and display the buffer of pane 0 in tetra_pm_main session
    tmux capture-pane -p -t "tetra_pm_main:.0"
}
tetra_pm_execute() {
    local command="$1"
    local first_token=$(echo "$command" | awk '{print $1}')
    local session_name="tetra_pm_${first_token}_$$"

    # Start the process in a new tmux session
    local base_command=$(construct_command)
    tmux new-session -d -s "$session_name" "$base_command '$command 2>&1 | tee -a $TETRA_LOG'"

    # Log the session start
    echo "Session $session_name started with command: $command" | tee -a $TETRA_LOG
}

tetra_pm_loop() {
    local command="$1"
    local interval="$2"
    local first_token=$(echo "$command" | awk '{print $1}')
    local session_name="tetra_pm_${first_token}_$$"

    # Start the process in a new tmux session
    local base_command=$(construct_command)
    tmux new-session -d -s "$session_name" "$base_command 'while true; do $command 2>&1 | tee -a $TETRA_LOG; sleep $interval; done'"

    # Log the session start
    echo "Session $session_name started with command: $command, looping every $interval seconds" | tee -a $TETRA_LOG
}

