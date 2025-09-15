tetra_tmux_new(){
  local sessionName="${1:-"untitled-session"}"
  local scriptName="${2:-"/dev/null"}"
  tmux new-session -d -s "$sessionName" "$scriptName"
}

tetra_tmux_list(){
  tmux list-sessions # aka tmux ls
}

tetra_tmux_join ()
{
    tmux has-session -t $1  2>/dev/null &&  \
    tmux attach-session -t $1 || \
    tmux new-session -s $1
}



tetra_tmux_run() {
    if ! tmux has-session -t "$1" 2>/dev/null; then
        export TETRA_SRC
        tmux new-session -d -s "$1"
        # Source the bootstrap script and redirect output to /dev/null
        tmux send-keys -t "${1}" "source \$TETRA_SRC/bootstrap.sh &> /dev/null" C-m
        # Send any additional commands passed to the function
        tmux send-keys -t "${1}" "${@:2}" C-m
        tetra_tmux_join $1
    else
        tetra_tmux_join $1
    fi
}

tetra_tmux_restart() {
    # Ensure correct shell is used and source the bootstrap script
    tmux new-session -d -s "$1" "/bin/bash --rcfile $TETRA_SRC/bootstrap.sh"
    
    # After ensuring session is ready, send the command
    tmux send-keys -t "$1" "tetra_python_run webhook-flask.py" C-m
    if tmux has-session -t "$1" 2>/dev/null; then
        tmux kill-session -t "$1"
        echo "Session $1 killed. Creating a new one."
        tmux new-session -d -s "$1" "/bin/bash --rcfile $TETRA_SRC/bootstrap.sh"
        tmux send-keys -t "$1" "tetra_python_run webhook-flask.py" C-m
    else
        echo "$1 not found, creating new session."
        tmux new-session -d -s "$1" "/bin/bash --rcfile $TETRA_SRC/bootstrap.sh"
        tmux send-keys -t "$1" "tetra_python_run webhook-flask.py" C-m
    fi
        tetra_tmux_join $1
}



# Function to kill a tmux session
tetra_tmux_kill() {
    tmux kill-session -t "$1"
}

tetra_tmux_kill_server(){
  echo "Will kill everything tmux."
  tmux list-sessions
  read -p "Sure? ctrl-c to exit."
  tmux kill-server
}

tetra_tmux_load_conf(){
  local confFile="$TETRA_SRC/tetra.tmux.conf"
  tmux source-file "$confFile"
}

# Function to list all active tmux sessions
tetra_tmux_list_sessions() {
    tmux list-sessions
}

# Function to list all panes in a specified tmux session
tetra_tmux_list_panes() {
    local session_name="$1"
    tmux list-panes -t "$session_name"
}

# Function to capture the buffer of a specific pane in a specific tmux session
tetra_tmux_capture_pane() {
    local session_name="$1"
    local pane_id="$2"
    tmux capture-pane -p -t "${session_name}:${pane_id}"
}

# Example usage:
# source this_script.sh
# tetra_tmux_list_sessions
# tetra_tmux_list_panes session_name
# tetra_tmux_capture_pane session_name pane_id

