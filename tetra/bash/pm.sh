#!/bin/bash

# Determine OS and set BASH_PATH accordingly
if [[ "$(uname)" == "Darwin" ]]; then
    # macOS with Homebrew
    # BASH_PATH="/usr/local/bin/bash"  # Default path for Intel Macs
     BASH_PATH="/opt/homebrew/bin/bash"  # Uncomment for Apple Silicon Macs
else
    # Linux and possibly other Unix-like systems
    BASH_PATH="/bin/bash"
fi

# Construct the command with a clean environment,
# and explicitly set PATH based on the operating system
if [[ "$(uname)" == "Darwin" ]]; then
    # For macOS, include Homebrew bash directory in PATH
    command="exec env -i PATH='/usr/bin:/bin:/usr/sbin:/sbin:${BASH_PATH%/*}' \
${BASH_PATH} --noprofile --norc -c '...'"
else
    # For Linux, use the system bash path directly
    command="exec env -i PATH='/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin' \
$BASH_PATH --noprofile --norc -c '...'"
fi


# Define multiple color palettes for the status bar
#declare -a status_fg=("colour0" "colour2" "colour4" \
#           "colour6" "colour8" "colour10" "colour12" "colour14")
#declare -a status_bg=("colour1" "colour3" "colour5" \
#           "colour7" "colour9" "colour11" "colour13" "colour15")

# Foreground (text) colors - bright versions for better visibility
declare -a status_fg=("colour226" "colour214" "colour202" \
 "colour190" "colour154" "colour118" "colour82" "colour46")

# Background colors - darker shades for contrast
declare -a status_bg=("colour52" "colour53" "colour54" \
  "colour55" "colour56" "colour57" "colour58" "colour59")


color_index=0

get_next_color_scheme() {
    local fg_color="${status_fg[color_index]}"
    local bg_color="${status_bg[color_index]}"
    color_index=$(( (color_index + 1) % ${#status_fg[@]} ))

    echo "$fg_color" "$bg_color"
}


# Ensure the main management session exists with a clean environment
tetra_pm_ensure_main_session() {
    if ! tmux has-session -t "tetra_pm_main" 2>/dev/null; then
        tmux new-session -d -s "tetra_pm_main" "exec env -i bash --noprofile --norc"
    fi
}

# Start a new process with a clean environment
tetra_pm_start() {
    tetra_pm_ensure_main_session
    
    local process_name="tetra_pm_$1"
    local process_dir="$1"  # Directory name matches the process name
    
    if tmux has-session -t "$process_name" 2>/dev/null; then
        tetra_pm_log "Error: Process '$1' already exists."
        return 1
    fi

    shift  # Move past the first argument to process the remaining ones
    
    local command
    if [ $# -eq 0 ]; then
        local entrypoint="${process_dir}/entrypoint.sh"
        if [ ! -f "$entrypoint" ]; then
            tetra_pm_log "Error: Entry point script for '$1' not found in ${process_dir}."
            return 1
        fi
        command="exec env -i $BASH_PATH --noprofile --norc -c 'cd ${process_dir} && ./entrypoint.sh'"
    else
        command="exec env -i $BASH_PATH --noprofile --norc -c '$*'"
    fi

    read fg_color bg_color <<< $(get_next_color_scheme)
    tmux new-session -d -s "$process_name" "$command"
    tmux pipe-pane -t "${process_name}:.0" 'cat > /tmp/${process_name}_output.log'

    tmux set-option -t "$process_name" status-bg "$bg_color"
    tmux set-option -t "$process_name" status-fg "$fg_color"
    tetra_pm_log "Session $process_name started with color scheme: FG=$fg_color, BG=$bg_color"

    # Allow brief time for session to start and possibly fail
    sleep 2

    # Check if the session is still running
    if tmux has-session -t "$process_name" 2>/dev/null; then
        echo "Session $process_name started with color scheme: FG=$fg_color, BG=$bg_color"
    else
        echo "Failed to start session $process_name or it terminated prematurely."
        return 2  # Return a different error code for this specific failure
    fi
}


# Start a new process with a clean environment
tetra_pm_start_good() {
    tetra_pm_ensure_main_session

    process_name="tetra_pm_$1"
    process_dir="$1"  # Directory name convention matches the process name

    # Check for existing session
    if tmux has-session -t "$process_name" 2>/dev/null; then
        echo "Error: Process '$1' already exists."
        return 1
    fi

    shift  # Move past the first argument to process the remaining ones

    if [ $# -eq 0 ]; then
        # No additional arguments, use entrypoint.sh with a clean environment
        entrypoint="${process_dir}/entrypoint.sh"
        if [ ! -f "$entrypoint" ]; then
            echo "Error: Entry point script for '$1' not found in ${process_dir}."
            return 1
        fi
        command="exec env -i $BASH_PATH --noprofile --norc -c 'cd ${process_dir} && ./entrypoint.sh'"
    else
        # Additional arguments present, treat as a bash command with a clean environment
        command="exec env -i $BASH_PATH --noprofile --norc -c '$*'"
    fi

    read fg_color bg_color <<< $(get_next_color_scheme)
    tmux new-session -d -s "$process_name" "$command"
    tmux set-option -t "$process_name" status-bg "$bg_color"
    tmux set-option -t "$process_name" status-fg "$fg_color"
    echo "Session $process_name started with color scheme: FG=$fg_color, BG=$bg_color"
}

# Stop a process
tetra_pm_stop() {
    process_name="tetra_pm_$1"
    if tmux has-session -t "$process_name" 2>/dev/null; then
        tmux kill-session -t "$process_name"
    else
        echo "Error: Process '$1' not found."
    fi
}

# List all processes
tetra_pm_list() {
    tmux list-sessions | grep 'tetra_pm_'
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


# Attach to the main management session
tetra_pm_attach_main() {
    if tmux has-session -t "tetra_pm_main" 2>/dev/null; then
        tmux attach-session -t "tetra_pm_main"
    else
        echo "Error: The main tetra_pm session does not exist."
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

# Function to log a message into the tetra_pm_main session with a hexadecimal timestamp
tetra_pm_log() {
    local message="$1"
    # Generate a hexadecimal timestamp
    local timestamp=$(date +%s)  # Unix timestamp in seconds
    local hex_timestamp=$(printf '%x\n' $timestamp)  # Convert to hexadecimal
    
    # Ensure the tetra_pm_main session exists
    if tmux has-session -t "tetra_pm_main" 2> /dev/null; then
        # Use pane 0 of tetra_pm_main for logging. Adjust as necessary.
        local target_pane="tetra_pm_main:.0"
        # Log the message with the timestamp
        tmux send-keys -t "$target_pane" "echo '$hex_timestamp: $message'" C-m
    else
        echo "The tetra_pm_main session does not exist."
    fi
}


# Display help information
tetra_pm_help() {
    cat << EOF
Tetra PM - tmux based process manager
-------------------------------------
tetra_pm_ensure_main_session: Ensures the main session exists
tetra_pm_start <name>: Start a new process in <name> directory
tetra_pm_stop <name>: Stop the process with <name>
tetra_pm_list: List all running processes
tetra_pm_attach <name>: Attach to the process session <name>
tetra_pm_attach_main: Attach to the main management session
-------------------------------------
EOF
}

