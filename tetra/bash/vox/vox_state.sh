#!/usr/bin/env bash

# Vox Action State Machine - TES Compliant
# Following Tetra Endpoint Specification for action lifecycle
#
# States:
#   idle      - Neutral state (no action in progress)
#   template  - Action declared, needs inputs (QA ID, voice)
#   qualified - Inputs provided, needs validation
#   ready     - QA answer exists, audio can be generated
#   executing - API call in progress
#   caching   - Writing metadata and cache files
#   playing   - Audio playback in progress
#   success   - Completed successfully
#   error     - Failed with error

# State symbols for display (following demo/013 patterns)
declare -A VOX_STATE_SYMBOLS=(
    [idle]="●"
    [template]="○"
    [qualified]="◐"
    [ready]="◉"
    [executing]="▶"
    [caching]="⚙"
    [playing]="♪"
    [success]="✓"
    [error]="✗"
)

# Current action state (global for vox module)
VOX_CURRENT_STATE="idle"
VOX_CURRENT_ACTION=""
VOX_ERROR_MSG=""
VOX_STATUS_INFO=""

# Get current vox action state
vox_get_state() {
    echo "$VOX_CURRENT_STATE"
}

# Set vox action state
vox_set_state() {
    local new_state="$1"
    local action="${2:-$VOX_CURRENT_ACTION}"

    VOX_CURRENT_STATE="$new_state"
    [[ -n "$action" ]] && VOX_CURRENT_ACTION="$action"

    # Log state transition if TUI logging available
    if declare -f tetra_log &>/dev/null; then
        tetra_log "vox" "state" "$new_state" "event" "{\"action\":\"$action\"}"
    fi
}

# Get state symbol for display
vox_get_state_symbol() {
    local state="${1:-$VOX_CURRENT_STATE}"
    echo "${VOX_STATE_SYMBOLS[$state]:-●}"
}

# Set error state with message
vox_set_error() {
    local error_msg="$1"
    VOX_ERROR_MSG="$error_msg"
    vox_set_state "error"
}

# Get error message
vox_get_error() {
    echo "$VOX_ERROR_MSG"
}

# Clear error
vox_clear_error() {
    VOX_ERROR_MSG=""
}

# Set status info (contextual information to display)
vox_set_status() {
    local status_info="$1"
    VOX_STATUS_INFO="$status_info"
}

# Get status info
vox_get_status() {
    echo "$VOX_STATUS_INFO"
}

# Clear status info
vox_clear_status() {
    VOX_STATUS_INFO=""
}

# Reset to idle state
vox_reset_state() {
    VOX_CURRENT_STATE="idle"
    VOX_CURRENT_ACTION=""
    VOX_ERROR_MSG=""
    VOX_STATUS_INFO=""
}

# Check if vox is ready to execute (qualified + validated)
vox_is_ready() {
    [[ "$VOX_CURRENT_STATE" == "ready" ]]
}

# Check if vox is executing
vox_is_executing() {
    [[ "$VOX_CURRENT_STATE" == "executing" || "$VOX_CURRENT_STATE" == "caching" || "$VOX_CURRENT_STATE" == "playing" ]]
}

# Check if vox completed successfully
vox_is_success() {
    [[ "$VOX_CURRENT_STATE" == "success" ]]
}

# Check if vox has error
vox_has_error() {
    [[ "$VOX_CURRENT_STATE" == "error" ]]
}

# Validate inputs for vox action
vox_validate_inputs() {
    local qa_id="$1"
    local voice="$2"

    # Check QA ID exists
    local answer_file="$QA_DB_DIR/${qa_id}.answer"
    if [[ ! -f "$answer_file" ]]; then
        vox_set_error "QA answer not found: $qa_id"
        return 1
    fi

    # Check voice profile exists
    local voice_config="$VOX_VOICE_ENABLED/${voice}.toml"
    if [[ ! -f "$voice_config" ]]; then
        voice_config="$VOX_VOICE_AVAILABLE/${voice}.toml"
        if [[ ! -f "$voice_config" ]]; then
            vox_set_error "Voice profile not found: $voice"
            return 1
        fi
    fi

    return 0
}

# Qualify action (mark inputs as resolved)
vox_qualify_action() {
    local qa_id="$1"
    local voice="$2"

    if vox_validate_inputs "$qa_id" "$voice"; then
        vox_set_state "qualified" "vox.speak:${qa_id}"
        return 0
    fi

    return 1
}

# Mark action as ready (validated and safe to execute)
vox_mark_ready() {
    local qa_id="$1"
    local voice="$2"

    if vox_validate_inputs "$qa_id" "$voice"; then
        vox_set_state "ready" "vox.speak:${qa_id}"
        vox_set_status "Ready to generate audio"
        return 0
    fi

    return 1
}

# State machine diagram for documentation
vox_show_state_diagram() {
    cat <<'EOF'
Vox Action State Machine (TES-Compliant)

  idle ────┐
           │
           ↓
  template ○  (action declared, needs inputs)
           │
           ↓
  qualified ◐ (inputs provided, needs validation)
           │
           ↓
  ready ◉     (validated, can execute)
           │
           ↓
  executing ▶ (API call in progress)
           │
           ↓
  caching ⚙   (writing files and metadata)
           │
           ↓
  playing ♪   (audio playback)
           │
           ├──→ success ✓
           │
           └──→ error ✗

States:
  - idle:      No action in progress
  - template:  Action declared, needs QA ID and voice
  - qualified: Inputs provided, needs validation
  - ready:     QA answer exists, audio can be generated
  - executing: Calling TTS API (with progress updates)
  - caching:   Writing metadata and cache files
  - playing:   Playing generated audio
  - success:   Audio played successfully
  - error:     Failed at any stage

EOF
}
