#!/usr/bin/env bash
# Tetra REPL Temperature Loader
# Handles smooth TDS theme switching for module REPLs
# Uses TDS theme stack for proper system/module theme coordination

# Ensure dependencies
: "${TDS_SRC:?TDS_SRC must be set}"
source "$TDS_SRC/core/theme_stack.sh"

# ============================================================================
# STATE MANAGEMENT
# ============================================================================

# Track current temperature
declare -g REPL_CURRENT_TEMPERATURE="default"
declare -g REPL_CURRENT_MODULE=""
declare -g REPL_TEMPERATURE_ACTIVE=false

# ============================================================================
# TEMPERATURE LOADING
# ============================================================================

# Load temperature for a module (using theme stack)
repl_load_temperature() {
    local module="$1"
    local temperature=$(get_module_temperature "$module")

    # Skip if already loaded
    if [[ "$REPL_CURRENT_TEMPERATURE" == "$temperature" && "$REPL_TEMPERATURE_ACTIVE" == "true" ]]; then
        return 0
    fi

    # Validate temperature theme exists
    if [[ -z "${TDS_THEME_REGISTRY[$temperature]}" ]]; then
        echo "ERROR: Temperature theme not found: $temperature" >&2
        echo "Available themes: ${!TDS_THEME_REGISTRY[*]}" >&2
        return 1
    fi

    # If we already have a temperature active, pop it first
    if [[ "$REPL_TEMPERATURE_ACTIVE" == "true" ]]; then
        repl_exit_restore_theme 2>/dev/null || true
    fi

    # Enter with new temperature (pushes onto stack)
    if ! repl_enter_with_temperature "$module" "$temperature"; then
        echo "ERROR: Failed to load temperature '$temperature' for module '$module'" >&2
        REPL_TEMPERATURE_ACTIVE=false
        return 1
    fi

    # Update state
    REPL_CURRENT_TEMPERATURE="$temperature"
    REPL_CURRENT_MODULE="$module"
    REPL_TEMPERATURE_ACTIVE=true

    return 0
}

# Restore default temperature (pops theme stack)
repl_restore_default_temperature() {
    if [[ "$REPL_TEMPERATURE_ACTIVE" == "true" ]]; then
        repl_exit_restore_theme || {
            echo "WARNING: Failed to restore theme via stack, resetting to system theme" >&2
            tds_reset_to_system_theme
        }
        REPL_CURRENT_TEMPERATURE="default"
        REPL_CURRENT_MODULE=""
        REPL_TEMPERATURE_ACTIVE=false
    fi
}

# ============================================================================
# PHASE-SHIFT TRANSITIONS
# ============================================================================

# Create visual phase-shift effect when changing modules
repl_phase_shift() {
    local from_module="$1"
    local to_module="$2"

    local from_temp="${REPL_CURRENT_TEMPERATURE}"
    local to_temp=$(get_module_temperature "$to_module")

    # Skip if same temperature
    [[ "$from_temp" == "$to_temp" ]] && return 0

    # Visual feedback
    local from_marker=$(get_module_marker "$from_module")
    local to_marker=$(get_module_marker "$to_module")

    # Clear screen with old temperature
    clear

    # Brief visual indicator
    echo
    tds_text_color "repl.prompt"
    echo "  $from_marker → $to_marker"
    reset_color
    sleep 0.1

    # Load new temperature
    repl_load_temperature "$to_module"

    # Clear again with new temperature
    clear

    return 0
}

# ============================================================================
# TEMPERATURE INFO
# ============================================================================

# Get current temperature info
repl_get_temperature_info() {
    local format="${1:-simple}"  # simple, detailed

    case "$format" in
        simple)
            echo "$REPL_CURRENT_TEMPERATURE"
            ;;
        detailed)
            echo "Module: ${REPL_CURRENT_MODULE:-none}"
            echo "Temperature: $REPL_CURRENT_TEMPERATURE"
            echo "Active: $REPL_TEMPERATURE_ACTIVE"
            if [[ -n "$REPL_CURRENT_MODULE" ]]; then
                local marker=$(get_module_marker "$REPL_CURRENT_MODULE")
                echo "Marker: $marker"
            fi
            ;;
    esac
}

# Show temperature indicator in prompt
repl_temperature_indicator() {
    if [[ -n "$REPL_CURRENT_MODULE" ]]; then
        local marker=$(get_module_marker "$REPL_CURRENT_MODULE")
        tds_text_color "marker.primary"
        echo -n "$marker "
        reset_color
    fi
}

# ============================================================================
# TEMPERATURE VALIDATION
# ============================================================================

# Check if temperature is loaded
repl_is_temperature_loaded() {
    local temperature="$1"
    [[ "$REPL_CURRENT_TEMPERATURE" == "$temperature" ]]
}

# Check if module temperature is loaded
repl_is_module_temperature_loaded() {
    local module="$1"
    [[ "$REPL_CURRENT_MODULE" == "$module" ]]
}

# ============================================================================
# INITIALIZATION
# ============================================================================

# Ensure TDS temperature themes are sourced
repl_init_temperatures() {
    # Skip if already initialized
    if [[ "${REPL_TEMPERATURES_INITIALIZED:-}" == "true" ]]; then
        return 0
    fi

    local tds_themes="$TDS_SRC/themes"

    # Check if themes are already registered (they should be loaded by TDS)
    for temp in warm cool neutral electric; do
        if [[ -z "${TDS_THEME_REGISTRY[$temp]}" ]]; then
            # Theme not registered, try to load it
            if [[ -f "$tds_themes/${temp}.sh" ]]; then
                TDS_QUIET_LOAD=1 source "$tds_themes/${temp}.sh" 2>/dev/null || {
                    echo "Warning: Failed to load temperature: $temp" >&2
                }
            fi
        fi
    done

    # Mark as initialized
    REPL_TEMPERATURES_INITIALIZED=true
    export REPL_TEMPERATURES_INITIALIZED
}

# ============================================================================
# EXPORT
# ============================================================================

export -f repl_load_temperature
export -f repl_restore_default_temperature
export -f repl_phase_shift
export -f repl_get_temperature_info
export -f repl_temperature_indicator
export -f repl_is_temperature_loaded
export -f repl_is_module_temperature_loaded
export -f repl_init_temperatures

# Auto-initialize
repl_init_temperatures
