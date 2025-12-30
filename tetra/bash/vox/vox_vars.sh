#!/usr/bin/env bash
# vox_vars.sh - Variable registry with typed values and MIDI CC learning
#
# Variables are typed (enum, range) with validation and completion support.
# MIDI CC values (0-127) are mapped to variable ranges automatically.
#
# Usage:
#   vox set voice shimmer
#   vox set volume 80
#   vox learn voice        # Move CC to assign
#   vox cc list            # Show mappings

[[ -n "$_VOX_VARS_LOADED" ]] && return 0
_VOX_VARS_LOADED=1

# =============================================================================
# VARIABLE DEFINITIONS
# =============================================================================

# Format: type:default:constraints
# Types:
#   enum   - type:default:option1,option2,option3
#   range  - type:default:min:max
#   string - type:default

declare -gA VOX_VAR_DEFS=(
    [voice]="enum:alloy:alloy,ash,coral,echo,fable,nova,onyx,sage,shimmer"
    [provider]="enum:openai:openai,coqui,formant"
    [source]="enum:qa:qa,chat,file,stdin"
    [volume]="range:100:0:127"
    [speed]="range:100:25:200"
    [pitch]="range:100:50:150"
    [highlight]="enum:word:word,phoneme,line,off"
    [theme]="enum:default:default,warm,cool,arctic,electric,neutral"
    [emotion]="enum:neutral:neutral,happy,sad,angry,surprised"
    [sync_mode]="enum:realtime:realtime,stepped,manual"
)

# Current values
declare -gA VOX_VARS=()

# MIDI CC mappings: cc_number -> variable_name
declare -gA VOX_CC_MAP=()

# Reverse mapping: variable_name -> cc_number
declare -gA VOX_VAR_CC=()

# CC config file
VOX_CC_FILE="${VOX_DIR:-$TETRA_DIR/vox}/cc_map.conf"

# =============================================================================
# INITIALIZATION
# =============================================================================

# Initialize variables with defaults
vox_vars_init() {
    for var in "${!VOX_VAR_DEFS[@]}"; do
        local def="${VOX_VAR_DEFS[$var]}"
        local default="${def#*:}"
        default="${default%%:*}"
        VOX_VARS[$var]="$default"
    done

    # Load saved CC mappings
    vox_cc_load
}

# =============================================================================
# VARIABLE ACCESS
# =============================================================================

# Get variable value
vox_var_get() {
    local name="$1"
    echo "${VOX_VARS[$name]:-}"
}

# Set variable with validation
vox_var_set() {
    local name="$1"
    local value="$2"

    local def="${VOX_VAR_DEFS[$name]}"
    if [[ -z "$def" ]]; then
        echo "Unknown variable: $name" >&2
        echo "Available: ${!VOX_VAR_DEFS[*]}" >&2
        return 1
    fi

    local type="${def%%:*}"

    case "$type" in
        enum)
            local options="${def##*:}"
            if [[ ",$options," == *",$value,"* ]]; then
                VOX_VARS[$name]="$value"
                return 0
            else
                echo "Invalid value '$value' for $name" >&2
                echo "Options: $options" >&2
                return 1
            fi
            ;;
        range)
            local rest="${def#*:}"
            rest="${rest#*:}"  # Skip default
            local min="${rest%%:*}"
            local max="${rest#*:}"

            if [[ "$value" =~ ^[0-9]+$ ]] && (( value >= min && value <= max )); then
                VOX_VARS[$name]="$value"
                return 0
            else
                echo "Invalid value '$value' for $name" >&2
                echo "Range: $min-$max" >&2
                return 1
            fi
            ;;
        string)
            VOX_VARS[$name]="$value"
            return 0
            ;;
    esac
}

# Set variable from MIDI CC value (0-127)
vox_var_set_from_cc() {
    local name="$1"
    local cc_value="$2"  # 0-127

    local def="${VOX_VAR_DEFS[$name]}"
    [[ -z "$def" ]] && return 1

    local type="${def%%:*}"

    case "$type" in
        enum)
            local options="${def##*:}"
            IFS=',' read -ra opts <<< "$options"
            local count=${#opts[@]}
            local idx=$(( cc_value * (count - 1) / 127 ))
            VOX_VARS[$name]="${opts[$idx]}"
            ;;
        range)
            local rest="${def#*:}"
            rest="${rest#*:}"  # Skip default
            local min="${rest%%:*}"
            local max="${rest#*:}"
            VOX_VARS[$name]=$(( min + (cc_value * (max - min) / 127) ))
            ;;
    esac
}

# Get completion values for variable
vox_var_complete() {
    local name="$1"

    local def="${VOX_VAR_DEFS[$name]}"
    [[ -z "$def" ]] && return

    local type="${def%%:*}"

    case "$type" in
        enum)
            local options="${def##*:}"
            echo "$options" | tr ',' '\n'
            ;;
        range)
            local rest="${def#*:}"
            rest="${rest#*:}"  # Skip default
            local min="${rest%%:*}"
            local max="${rest#*:}"
            echo "[$min-$max]"
            ;;
    esac
}

# List all variables with current values
vox_var_list() {
    printf "%-12s %-10s %-20s %s\n" "VARIABLE" "VALUE" "TYPE" "OPTIONS"
    printf "%-12s %-10s %-20s %s\n" "--------" "-----" "----" "-------"

    for var in $(echo "${!VOX_VAR_DEFS[@]}" | tr ' ' '\n' | sort); do
        local def="${VOX_VAR_DEFS[$var]}"
        local type="${def%%:*}"
        local value="${VOX_VARS[$var]:-}"
        local opts=""

        case "$type" in
            enum)
                opts="${def##*:}"
                ;;
            range)
                local rest="${def#*:}"
                rest="${rest#*:}"
                opts="${rest%%:*}-${rest#*:}"
                ;;
        esac

        # Show CC mapping if exists
        local cc="${VOX_VAR_CC[$var]:-}"
        [[ -n "$cc" ]] && value="$value (CC$cc)"

        printf "%-12s %-10s %-20s %s\n" "$var" "$value" "$type" "$opts"
    done
}

# =============================================================================
# MIDI CC LEARNING
# =============================================================================

# Learn CC for variable (waits for MIDI input)
vox_cc_learn() {
    local var_name="$1"
    local timeout="${2:-10}"

    if [[ -z "${VOX_VAR_DEFS[$var_name]}" ]]; then
        echo "Unknown variable: $var_name" >&2
        return 1
    fi

    echo "Move a MIDI CC to assign to '$var_name'..."
    echo "Timeout: ${timeout}s (press Ctrl-C to cancel)"

    # Use OSC listener to wait for CC
    local osc_listen="$TETRA_SRC/bash/midi/osc_listen"
    if [[ ! -x "$osc_listen" ]]; then
        echo "Error: osc_listen not available" >&2
        echo "MIDI CC learning requires the MIDI subsystem" >&2
        return 1
    fi

    local fifo="/tmp/vox_cc_learn_$$.pipe"
    mkfifo "$fifo" 2>/dev/null || return 1

    # Start listener in background
    "$osc_listen" -p 1983 -m 239.1.1.1 > "$fifo" 2>/dev/null &
    local listen_pid=$!

    # Open fifo for reading
    exec 8<"$fifo"

    local cc=""
    local start_time=$(date +%s)

    while (( $(date +%s) - start_time < timeout )); do
        if read -t 0.5 -r line <&8 2>/dev/null; then
            if [[ "$line" =~ raw[[:space:]]+CC[[:space:]]+([0-9]+)[[:space:]]+([0-9]+)[[:space:]]+([0-9]+) ]]; then
                cc="${BASH_REMATCH[2]}"
                break
            fi
        fi
    done

    # Cleanup
    exec 8<&-
    kill "$listen_pid" 2>/dev/null
    rm -f "$fifo"

    if [[ -n "$cc" ]]; then
        # Remove old mapping for this variable
        local old_cc="${VOX_VAR_CC[$var_name]}"
        [[ -n "$old_cc" ]] && unset "VOX_CC_MAP[$old_cc]"

        # Remove old mapping for this CC
        local old_var="${VOX_CC_MAP[$cc]}"
        [[ -n "$old_var" ]] && unset "VOX_VAR_CC[$old_var]"

        # Set new mapping
        VOX_CC_MAP[$cc]="$var_name"
        VOX_VAR_CC[$var_name]="$cc"

        echo "CC$cc -> $var_name"
        vox_cc_save
        return 0
    else
        echo "Timeout - no CC received" >&2
        return 1
    fi
}

# Handle incoming CC (called from MIDI listener)
vox_cc_handle() {
    local cc="$1"
    local value="$2"

    local var="${VOX_CC_MAP[$cc]}"
    if [[ -n "$var" ]]; then
        vox_var_set_from_cc "$var" "$value"
        # Trigger callback if defined
        if declare -f vox_on_var_change &>/dev/null; then
            vox_on_var_change "$var" "${VOX_VARS[$var]}"
        fi
    fi
}

# List CC mappings
vox_cc_list() {
    if [[ ${#VOX_CC_MAP[@]} -eq 0 ]]; then
        echo "No CC mappings defined"
        echo "Use 'vox learn <variable>' to create mappings"
        return 0
    fi

    printf "%-6s %-12s %-10s\n" "CC" "VARIABLE" "VALUE"
    printf "%-6s %-12s %-10s\n" "--" "--------" "-----"

    for cc in $(echo "${!VOX_CC_MAP[@]}" | tr ' ' '\n' | sort -n); do
        local var="${VOX_CC_MAP[$cc]}"
        local val="${VOX_VARS[$var]:-}"
        printf "CC%-4s %-12s %-10s\n" "$cc" "$var" "$val"
    done
}

# Clear all CC mappings
vox_cc_clear() {
    VOX_CC_MAP=()
    VOX_VAR_CC=()
    rm -f "$VOX_CC_FILE"
    echo "CC mappings cleared"
}

# Save CC mappings to file
vox_cc_save() {
    mkdir -p "$(dirname "$VOX_CC_FILE")"

    {
        echo "# VOX CC Mappings"
        echo "# Generated: $(date)"
        for cc in "${!VOX_CC_MAP[@]}"; do
            echo "$cc=${VOX_CC_MAP[$cc]}"
        done
    } > "$VOX_CC_FILE"
}

# Load CC mappings from file
vox_cc_load() {
    [[ -f "$VOX_CC_FILE" ]] || return 0

    while IFS='=' read -r cc var; do
        [[ "$cc" =~ ^#.*$ || -z "$cc" ]] && continue
        VOX_CC_MAP[$cc]="$var"
        VOX_VAR_CC[$var]="$cc"
    done < "$VOX_CC_FILE"
}

# =============================================================================
# CONTEXT PROMPT
# =============================================================================

# Generate prompt string showing current context
vox_ctx_prompt() {
    local provider="${VOX_VARS[provider]:-openai}"
    local voice="${VOX_VARS[voice]:-alloy}"
    local source="${VOX_VARS[source]:-qa}"

    printf 'VOX[%s:%s:%s]' "$provider" "$voice" "$source"
}

# =============================================================================
# CLI HANDLERS
# =============================================================================

# Handle 'vox set' command
vox_cmd_set() {
    local var="$1"
    local val="$2"

    if [[ -z "$var" ]]; then
        vox_var_list
        return 0
    fi

    if [[ -z "$val" ]]; then
        echo "${VOX_VARS[$var]:-<unset>}"
        return 0
    fi

    vox_var_set "$var" "$val"
}

# Handle 'vox learn' command
vox_cmd_learn() {
    local var="$1"

    if [[ -z "$var" ]]; then
        echo "Usage: vox learn <variable>"
        echo "Variables: ${!VOX_VAR_DEFS[*]}"
        return 1
    fi

    vox_cc_learn "$var"
}

# Handle 'vox cc' command
vox_cmd_cc() {
    local subcmd="${1:-list}"
    shift 2>/dev/null || true

    case "$subcmd" in
        list|ls)
            vox_cc_list
            ;;
        clear)
            vox_cc_clear
            ;;
        save)
            vox_cc_save
            echo "CC mappings saved to $VOX_CC_FILE"
            ;;
        load)
            vox_cc_load
            echo "CC mappings loaded"
            vox_cc_list
            ;;
        *)
            echo "Usage: vox cc <list|clear|save|load>"
            ;;
    esac
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f vox_vars_init vox_var_get vox_var_set vox_var_set_from_cc
export -f vox_var_complete vox_var_list
export -f vox_cc_learn vox_cc_handle vox_cc_list vox_cc_clear vox_cc_save vox_cc_load
export -f vox_ctx_prompt
export -f vox_cmd_set vox_cmd_learn vox_cmd_cc

# Initialize on source
vox_vars_init
