function tetra_pm_kill_all() {
    # Kill all tetra_pm related processes
    # TODO: list=($(ps -ef | grep tetra_pm))  # array of tetra_pm processes
    # For now, kill the common ones used during development
    pkill -f 'tetra_pm_power'
    pkill -f 'tetra_pm_ping'
    pkill -f 'tetra_pm_pong'

    # Kill all tmux sessions
    echo Kill everything with > /dev/stderr
    echo tmux kill-server

    echo "All tetra_pm processes been terminated."
}

tetra_pm_processes() {
    # Get the PID of the main tmux session that likely starts the tetra_pm processes
    local tmux_main_pid=$(ps -ax | grep '[t]mux' | awk '{print $1}')

    # Display the main tmux process
    echo "Main tmux process:"
    ps -o pid,ppid,pgid,command -p $tmux_main_pid

    # Get all child PIDs of the main tmux process using pgrep to look for children processes
    local child_pids=$(pgrep -P $tmux_main_pid)

    # Display all child processes of the main tmux process
    echo "Child processes of tmux:"
    for pid in $child_pids; do
        ps -o pid,ppid,pgid,command -p $pid
    done
    # Specifically look for processes related to tetra_pm by filtering commands
    echo "Detailed tetra_pm processes:"
    ps -ef | grep 'tetra_pm' | grep -v grep
}

tetra_pm_kill_sessions() {
    # Get the PID of the main tmux session that likely starts the tetra_pm processes
    local tmux_main_pid=$(ps -ax | grep '[t]mux' | awk '{print $1}')

    # Get all child PIDs of the main tmux process using pgrep to look for children processes
    local child_pids=$(pgrep -P $tmux_main_pid)

    # Kill all child processes of the main tmux process
    for pid in $child_pids; do
        kill $pid
    done

    # Kill the main tmux process
    #kill $tmux_main_pid

    echo "All tetra_pm sessions have been stopped."
}


tetra_pm_restart() {
    local session_name="tetra_pm_$1"  # Ensure only one prefix is added

    # Check if the session exists
    if tmux has-session -t "$session_name" 2>/dev/null; then
        # Retrieve the full directory path from tmux environment
        local full_dirpath=$(tmux show-environment -t "$session_name" START_PATH | cut -d '=' -f2- | tr -d '\n')

        if [[ -n "$full_dirpath" && -d "$full_dirpath" && -f "$full_dirpath/entrypoint.sh" ]]; then
            # Stop the process
            tetra_pm_stop "$1"
            # Restart the process
            tetra_pm_start "$full_dirpath" ${@:2}
        else
            echo "Error: Directory '$full_dirpath' or entrypoint.sh not found."
        fi
    else
        echo "Error: Process '$session_name' not found."
    fi
}

tetra_pm_restart_all() {
    # Ensure the main session is running first
    _tetra_pm_ensure_main_session

    # Log the restart attempt in the main session
    tetra_pm_log "tetra_pm_main" "Restarting all managed sessions."

    # List all sessions and filter out the main session
    local sessions=$(tmux list-sessions -F "#{session_name}" | grep -v "^tetra_pm_main$")

    for session in $sessions; do
        # Extract the process directory from the session name, assuming naming convention "tetra_pm_<dir>"
        local process_dir=${session#"tetra_pm_"}

        # Stop the session
        tmux kill-session -t "$session"
        tetra_pm_log "$session" "Stopped session $session."

        # Restart the process
        # Note: This assumes `tetra_pm_start` can be called without additional parameters
        # or that such parameters are handled internally based on the process directory.
        tetra_pm_start "$process_dir"
        tetra_pm_log "$session" "Restarted session $session."
    done

    tetra_pm_log "tetra_pm_main" "All managed sessions have been restarted."
}

# Stop a process
tetra_pm_stop() {
    process_name="tetra_pm_$1"

    if tmux has-session -t "$process_name" 2>/dev/null; then
        tmux kill-session -t "$process_name"
    else
        echo "Error: Process '$1' not found."
    fi
    local fifo_out="$TETRA_FIFOS/${process_name}_out"
    if [[ -p $fifo_out ]]; then
        rm "$fifo_out"
    fi
}
tetra_pm_stop_all() {
    # Kill all sessions starting with "tetra_pm_" (process sessions)
    tmux list-sessions -F "#{session_name}" \
      | grep "^tetra_pm_" \
      | xargs -n 1 tmux kill-session -t

    # Kill the main management session
    if tmux has-session -t "tetra_pm_main" 2>/dev/null; then
        tmux kill-session -t "tetra_pm_main"
    fi

    echo "All tetra_pm sessions have been stopped."
}

# List all processes with their PIDs
tetra_pm_list() {
    # List all tmux sessions, filter those starting with 'tetra_pm_', and format the output
    tmux list-sessions -F "#{session_name} #{?session_attached,,(Detached)}" | grep '^tetra_pm_' | while IFS=' ' read -r session_name status; do
        # Extract the base name for the session to display it more clearly
        local base_name=${session_name#tetra_pm_}
        local pid=$(tmux list-panes -t "$session_name" -F "#{pane_pid}" | head -n 1)
        echo "tetra_pm_$base_name (PID: $pid) $status"
    done
}

# Attach to a specific process session
tetra_pm_attach() {
    local target_session="tetra_pm_$1"

    if [ -z "$TMUX" ]; then
        # Not currently in a tmux session, so attach to the target directly
        tmux attach-session -t "$target_session" 2>/dev/null || \
            echo "Session $target_session does not exist."
    else
        # Already inside a tmux session, switch to the target session
        tmux switch-client -t "$target_session" 2>/dev/null || \
            echo "Session $target_session does not exist."
    fi
}
