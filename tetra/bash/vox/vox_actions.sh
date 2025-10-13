#!/usr/bin/env bash

# Vox Action Registry - TES Action Template Declarations
# Defines vox actions following Tetra Endpoint Specification

# Action registry for vox module
declare -a VOX_ACTION_REGISTRY=()

# Declare vox.speak action template
# ACTION :: (qa_id:locator, voice:profile) → @tui[audio_player]
#   where Display(@tui[content]) ∧ Log(@app[stdout]) ∧ Cache(@vox[cache])
declare -A ACTION_vox_speak=(
    [module]="vox"
    [verb]="speak"
    [noun]=""  # Will be set to QA ID
    [inputs]="qa_id:locator,voice:profile"
    [output]="@tui[audio_player]"
    [effects]="@tui[content],@app[stdout],@vox[cache]"
    [state]="template"
    [validated]="false"
    [immediate]="false"
    [can]="Generate and play TTS audio from QA answer"
    [cannot]="Play audio without valid QA ID and voice profile"
)

VOX_ACTION_REGISTRY+=("vox_speak")

# Declare vox.generate action (generate without playing)
declare -A ACTION_vox_generate=(
    [module]="vox"
    [verb]="generate"
    [noun]=""
    [inputs]="qa_id:locator,voice:profile"
    [output]="@vox[cache]"
    [effects]="@tui[content],@app[stdout]"
    [state]="template"
    [validated]="false"
    [immediate]="false"
    [can]="Generate TTS audio and cache it"
    [cannot]="Generate without valid QA ID and voice profile"
)

VOX_ACTION_REGISTRY+=("vox_generate")

# Declare vox.replay action
declare -A ACTION_vox_replay=(
    [module]="vox"
    [verb]="replay"
    [noun]="last"
    [inputs]=""
    [output]="@tui[audio_player]"
    [effects]="@tui[content],@app[stdout]"
    [state]="idle"
    [validated]="true"
    [immediate]="true"
    [can]="Replay last played audio"
    [cannot]="Replay without previous audio"
)

VOX_ACTION_REGISTRY+=("vox_replay")

# Declare vox.cache-status action
declare -A ACTION_vox_cache_status=(
    [module]="vox"
    [verb]="cache"
    [noun]="status"
    [inputs]=""
    [output]="@tui[content]"
    [effects]="@app[stdout]"
    [state]="idle"
    [validated]="true"
    [immediate]="true"
    [can]="Show cache statistics and usage"
    [cannot]=""
)

VOX_ACTION_REGISTRY+=("vox_cache_status")

# Declare vox.voices action (list available voices)
declare -A ACTION_vox_voices=(
    [module]="vox"
    [verb]="list"
    [noun]="voices"
    [inputs]=""
    [output]="@tui[content]"
    [effects]="@app[stdout]"
    [state]="idle"
    [validated]="true"
    [immediate]="true"
    [can]="List all available voice profiles"
    [cannot]=""
)

VOX_ACTION_REGISTRY+=("vox_voices")

# Get action by name
vox_get_action() {
    local action_name="$1"

    # Normalize name (replace : with _)
    local normalized="${action_name//:/_}"

    if declare -p "ACTION_${normalized}" &>/dev/null; then
        echo "ACTION_${normalized}"
        return 0
    fi

    return 1
}

# List all vox actions
vox_list_actions() {
    for action in "${VOX_ACTION_REGISTRY[@]}"; do
        echo "$action"
    done
}

# Show action signature (TES format)
vox_show_action_signature() {
    local action_name="$1"
    local action_var=$(vox_get_action "$action_name")

    if [[ -z "$action_var" ]]; then
        echo "Unknown action: $action_name"
        return 1
    fi

    local -n action_ref="$action_var"

    local verb="${action_ref[verb]}"
    local noun="${action_ref[noun]}"
    local inputs="${action_ref[inputs]}"
    local output="${action_ref[output]}"
    local effects="${action_ref[effects]}"

    # Build TES signature
    local action_display="vox.${verb}"
    [[ -n "$noun" ]] && action_display="${action_display}:${noun}"

    local input_part="(${inputs})"
    local output_part="$output"
    [[ -n "$effects" ]] && output_part="$output where $effects"

    echo "$action_display :: $input_part → $output_part"
}

# Show all vox action signatures
vox_show_all_signatures() {
    echo "Vox Module Actions (TES Format)"
    echo "================================"
    echo

    for action in "${VOX_ACTION_REGISTRY[@]}"; do
        vox_show_action_signature "$action"
    done

    echo
    echo "Operators:"
    echo "  :: - Type signature"
    echo "  →  - Flow (input to output)"
    echo "  @  - Target annotation"
    echo
}

# Register action with qualified inputs
vox_register_qualified_action() {
    local qa_id="$1"
    local voice="$2"

    # Create qualified action name
    local action_name="vox_speak_${qa_id}"

    # Check if action already registered
    if declare -p "ACTION_${action_name}" &>/dev/null; then
        return 0
    fi

    # Copy template and qualify
    declare -gA "ACTION_${action_name}"
    local -n qualified_action="ACTION_${action_name}"
    local -n template_action="ACTION_vox_speak"

    # Copy all fields
    for key in "${!template_action[@]}"; do
        qualified_action[$key]="${template_action[$key]}"
    done

    # Set specific values
    qualified_action[noun]="$qa_id"
    qualified_action[inputs]="qa_id=$qa_id,voice=$voice"
    qualified_action[state]="qualified"

    echo "$action_name"
}
