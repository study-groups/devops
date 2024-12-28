
# Helper to check if the tmux session is still active after starting
_tetra_pm_check_session_active() {
    local process_name="$1"

    # Allow a brief moment for session stabilization
    sleep 2

    # Check if the tmux session with the given name is still running
    if tmux has-session -t "$process_name" 2>/dev/null; then
        return 0  # Return 0 if the session is still active
    else
        # Log that the session failed to start or terminated prematurely
        tetra_pm_log "$process_name" "Session failed to start or terminated."
        return 1  # Return 1 if the session is not active
    fi
}

_tetra_pm_check_session_exists() {
    local process_name="$1"
    if tmux has-session -t "$process_name" 2>/dev/null; then
        return 0  # Session exists
    else
        return 1  # Session does not exist
    fi
}

# Helper function to check session existence and script validity
_tetra_pm_check_session_and_script() {
    local process_name="$1"
    local entrypoint="$2"
    local process_dir="${entrypoint%/*}"

    # Check if the session already exists
    if _tetra_pm_check_session_exists "$process_name"; then
        echo "Session $process_name already exists." \
        | tee -a $TETRA_LOG
        return 1
    fi

    # Check if the entry point script exists
    if [ ! -f "$entrypoint" ]; then
        echo "Error: Entry point script not found in ${process_dir}." | tee -a $TETRA_LOG
        return 1
    fi

    # Check if the entry point script is executable
    if [ ! -x "$entrypoint" ]; then
        echo "Error: Entry point script is not executable. Please check permissions." | tee -a $TETRA_LOG
        chmod +x "$entrypoint"  # Optionally try to make it executable
    fi
}
_ensure_log_file() {
    local log_dir=$(dirname "$TETRA_LOG")
    if [ ! -d "$log_dir" ]; then
        mkdir -p "$log_dir"
    fi
    if [ ! -f "$TETRA_LOG" ]; then
        touch "$TETRA_LOG"
    fi
}

# Determine OS and set BASH_PATH accordingly
if [[ "$(uname)" == "Darwin" ]]; then
    # macOS with Homebrew
    BASH_PATH="/opt/homebrew/bin/bash"  # Uncomment for Apple Silicon Macs
    export PATH=/opt/homebrew/bin:$PATH
else
    # Linux and possibly other Unix-like systems
    BASH_PATH="/bin/bash"
fi

