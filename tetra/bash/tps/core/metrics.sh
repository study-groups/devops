#!/usr/bin/env bash
# tps/core/metrics.sh - Command duration & exit code tracking

# Metrics storage (exported for access)
declare -g TPS_LAST_DURATION=0
declare -g TPS_LAST_EXIT_CODE=0
declare -g TPS_DURATION_THRESHOLD=5

# Internal timing state
declare -g _TPS_CMD_START=0
declare -g _TPS_CMD_ACTIVE=0

# Called before each command (trap DEBUG)
_tps_pre_exec() {
    # Skip for prompt-related commands
    [[ -z "$BASH_COMMAND" ]] && return
    [[ "$BASH_COMMAND" == "tps_prompt" ]] && return
    [[ "$BASH_COMMAND" == "$PROMPT_COMMAND" ]] && return
    [[ "$BASH_COMMAND" == _tps_* ]] && return

    # Record start time
    _TPS_CMD_START="$SECONDS"
    _TPS_CMD_ACTIVE=1
}

# Called by post_command hook (captures metrics)
_tps_capture_metrics() {
    # Only capture if a command was active
    if [[ $_TPS_CMD_ACTIVE -eq 1 ]]; then
        TPS_LAST_DURATION=$((SECONDS - _TPS_CMD_START))
        _TPS_CMD_ACTIVE=0
        _TPS_CMD_START=0
    fi
}

# Initialize metrics tracking
_tps_metrics_init() {
    # Set up DEBUG trap for pre-exec timing
    trap '_tps_pre_exec' DEBUG

    # Register post_command hook for capture
    tps_hook_register post_command _tps_capture_metrics 10
}

# Get formatted duration string (only if > threshold)
tps_format_duration() {
    [[ $TPS_LAST_DURATION -le $TPS_DURATION_THRESHOLD ]] && return

    local secs=$TPS_LAST_DURATION
    if (( secs >= 3600 )); then
        printf "%dh%dm" $((secs/3600)) $(((secs%3600)/60))
    elif (( secs >= 60 )); then
        printf "%dm%ds" $((secs/60)) $((secs%60))
    else
        printf "%ds" "$secs"
    fi
}

# Duration segment for info area
_tps_segment_duration() {
    local dur
    dur=$(tps_format_duration)
    [[ -z "$dur" ]] && return

    echo "${_TPS_C_DURATION}[${dur}]${_TPS_C_RESET}"
}

# Register duration segment
_tps_register_duration_segment() {
    tps_register_segment info 80 duration _tps_segment_duration
}

# Get all metrics (diagnostic)
tps_get_metrics() {
    echo "exit_code: $TPS_LAST_EXIT_CODE"
    echo "duration:  ${TPS_LAST_DURATION}s"
    echo "threshold: ${TPS_DURATION_THRESHOLD}s"
}

export TPS_LAST_DURATION TPS_LAST_EXIT_CODE TPS_DURATION_THRESHOLD
export -f _tps_pre_exec _tps_capture_metrics _tps_metrics_init
export -f tps_format_duration _tps_segment_duration _tps_register_duration_segment
export -f tps_get_metrics
