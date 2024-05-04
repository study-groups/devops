#!/usr/bin/env bash
TETRA_LOG="$TETRA_SRC/tetra.log"
MAX_LOG_LINES=10000

_tetra_pm_ensure_main_session_DELETE() {
    if ! tmux has-session -t "tetra_pm_main" 2>/dev/null; then
        tmux new-session -d -s "tetra_pm_main" -c "$TETRA_SRC" exec -a "tetra_pm_main" $BASH_PATH
        tmux send-keys -t "tetra_pm_main" \
            "tail -f $TETRA_LOG 2>> $TETRA_SRC/process.log | _tetra_pm_process_log" C-m
    else
        exit 0
    fi
}

_tetra_pm_set_color() {
    local type=$1
    local color_key="${type// /_}"
    local color="${color_map[$color_key]}"
    if [[ -n $color ]]; then
        local color_scheme=($(get_next_color_scheme))
        tput setaf $color_scheme  # Set the color based on the color scheme
    else
        tput setaf 9  # Default color if type is not found in color map
    fi
}

_tetra_pm_display_object() {
    local display_object="$1"
    tput sgr0  # Reset the color
    echo "$display_object"
}


_color_by_type() {
    local type=$1
    local color_key="${type// /_}"
    local color="${color_map[$color_key]}"
    if [[ -n $color ]]; then
        local color_scheme=($(get_next_color_scheme))
        tput setaf ${color_scheme[0]}  # Set the foreground color
        tput setab ${color_scheme[1]}  # Set the background color
    else
        tput setaf 9  # Default color if type is not found in color map
    fi
}

_tetra_pm_format_tetra_log() {
    local pico_object=$1
    local timestamp=$(echo "$pico_object" | cut -d ' ' -f 1)
    local src=$(echo "$pico_object" | cut -d ' ' -f 2)
    local dest=$(echo "$pico_object" | cut -d ' ' -f 3)
    local type=$(echo "$pico_object" | cut -d ' ' -f 4)
    local msg=$(echo "$pico_object" | cut -d ' ' -f 5-)

    local formatted_log="[$timestamp] $src -> $dest [$type]: $msg"
    echo "$formatted_log"
}

_tetra_pm_process_log() {
    while IFS= read -r line; do
        local pico_object=$(_tetra_pm_process_pico_object "$line")
        local type=$(echo "$pico_object" | cut -d ' ' -f 6)
        _tetra_pm_set_color "$type"
        tetra_pm_display_object "$display_object"
    done
}

_tetra_pm_process_log_DELETE() {
    while IFS= read -r line; do
        local pico_object=$(_tetra_pm_process_pico_object "$line")
        local display_object=$(_tetra_pm_format_tetra_log "$pico_object")
        tput setaf 2  # Set the color to green
        echo "$display_object"
        tput sgr0  # Reset the color
    done
}
_tetra_pm_process_pico_object() {
    local pico_object="$1"
    if _tetra_pico_object_is_valid "$pico_object"; then
        echo "$pico_object"
    else
        # Create a new pico object with MSG and line, set src to tetra_pm
        local new_pico_object=$(tetra_pico_object_create tetra_pm "MSG" "$line" )
        echo "$new_pico_object"
    fi
}

# Usage of the function
_tetra_pm_process_output() {
    while IFS= read -r line; do
        _tetra_pm_process_pico_object "$line" >> "$TETRA_LOG"
    done
}

_tetra_pm_construct_env() {
    local os_path
    if [[ -n "$BASH_PATH" ]]; then
        os_path="$(dirname $BASH_PATH):/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
    else
        os_path="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
    fi
    echo "env -i HOME=$HOME \
TETRA_SRC='$TETRA_SRC' \
TETRA_DIR='$TETRA_DIR' \
PATH='$os_path'"
}

tetra_pm_start() {
    local dirname=$1
    local dirpath="$(realpath $dirname)"
    local basename="$(basename $dirname)"
    local process_name="tetra_pm_$basename"
    local entrypoint="${dirpath}/entrypoint.sh"

    # Check if the session and script are valid before proceeding
    if ! _tetra_pm_check_session_and_script "$process_name" "$entrypoint"; then
        echo "Session check failed or entrypoint script does not exist."
        return 1
    fi

    # Construct the environment for the new session
    local base_env=$(_tetra_pm_construct_env)

    # Start the process in a new tmux session with a clean environment
    tmux new-session -d -s "$process_name" \
        -c "$dirpath" "exec -a $process_name $base_env $entrypoint 2>&1"
    tmux pipe-pane -t "$process_name:.0" \
        -O "export TETRA_SRC=$TETRA_SRC; \
    export TETRA_DIR=$TETRA_DIR; \
    export PATH=$PATH; \
    /opt/homebrew/bin/bash -c 'source $TETRA_SRC/bootstrap.sh; \
    _tetra_pm_process_output > debug_log.txt 2>&1'"
}


tetra_pm_main_init() {
    tmux start-server # just in case
    if tmux has-session -t "tetra_pm_main" 2>/dev/null; then
        tmux kill-session -t "tetra_pm_main"
        echo "Previous main management session terminated."
    fi
    sleep 0.5
    echo "Starting main session with log path: $TETRA_LOG"
    _tetra_pm_ensure_main_session
}

_tetra_pm_ensure_main_session() {
    if ! tmux has-session -t "tetra_pm_main" 2>/dev/null; then
        echo "No session found, starting tetra_pm_main"
        tmux new-session -d -s "tetra_pm_main" -c "$TETRA_SRC" "$BASH_PATH" -c "exec -a tetra_pm_main2 $SHELL"
        tmux send-keys -t "tetra_pm_main" \
            "tail -f $TETRA_LOG | _tetra_pm_process_log 2>> $TETRA_SRC/process.log" C-m
    else
        return 0
    fi
}


tetra_pm_log() {
    tetra_pico_object_create tetra_pm MSG "${@}" >> "$TETRA_LOG"
}
