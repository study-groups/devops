#!/usr/bin/env bash

# Handler Dependencies - Function injection for handlers
# Provides required functions that handlers depend on

# Check if running in full app context or standalone
HANDLER_CONTEXT="${HANDLER_CONTEXT:-standalone}"

# Color state functions
if ! command -v refresh_color_state_cached >/dev/null 2>&1; then
    refresh_color_state_cached() {
        local verb="$1"
        local noun="$2"

        if [[ "$HANDLER_CONTEXT" == "app" ]]; then
            # In app context, call real function if available
            if command -v _refresh_color_state_cached >/dev/null 2>&1; then
                _refresh_color_state_cached "$verb" "$noun"
            fi
        fi
        # Standalone context: no-op
    }
    export -f refresh_color_state_cached
fi

# Action routing functions
if ! command -v get_action_routing >/dev/null 2>&1; then
    get_action_routing() {
        local verb="$1"
        local noun="$2"

        if [[ "$HANDLER_CONTEXT" == "app" ]] && command -v _get_action_routing >/dev/null 2>&1; then
            _get_action_routing "$verb" "$noun"
        else
            # Default routing for standalone
            case "$verb" in
                "show") echo "input_keyboard → output_display" ;;
                "configure") echo "input_modal → output_display + output_config" ;;
                "test") echo "input_keyboard → output_display + output_log" ;;
                *) echo "input_keyboard → output_display" ;;
            esac
        fi
    }
    export -f get_action_routing
fi

# Rendering functions
if ! command -v render_action_verb_noun >/dev/null 2>&1; then
    render_action_verb_noun() {
        local verb="$1"
        local noun="$2"

        if [[ "$HANDLER_CONTEXT" == "app" ]] && command -v _render_action_verb_noun >/dev/null 2>&1; then
            _render_action_verb_noun "$verb" "$noun"
        else
            # Simple rendering for standalone
            echo "[$verb×$noun]"
        fi
    }
    export -f render_action_verb_noun
fi

if ! command -v render_response_type >/dev/null 2>&1; then
    render_response_type() {
        local verb="$1"
        local noun="$2"

        if [[ "$HANDLER_CONTEXT" == "app" ]] && command -v _render_response_type >/dev/null 2>&1; then
            _render_response_type "$verb" "$noun"
        else
            # Simple response for standalone
            echo " → response"
        fi
    }
    export -f render_response_type
fi

if ! command -v generate_section_separator >/dev/null 2>&1; then
    generate_section_separator() {
        if [[ "$HANDLER_CONTEXT" == "app" ]] && command -v _generate_section_separator >/dev/null 2>&1; then
            _generate_section_separator
        else
            echo "=========================================="
        fi
    }
    export -f generate_section_separator
fi

# Description functions
if ! command -v get_action_description >/dev/null 2>&1; then
    get_action_description() {
        local verb="$1"
        local noun="$2"

        if [[ "$HANDLER_CONTEXT" == "app" ]] && command -v _get_action_description >/dev/null 2>&1; then
            _get_action_description "$verb" "$noun"
        else
            # Basic descriptions for standalone
            case "$verb:$noun" in
                "show:demo") echo "Display TUI demo application overview" ;;
                "show:colors") echo "Show color system status and configuration" ;;
                "show:tui") echo "Display TUI framework information" ;;
                "show:input") echo "Show input system status and key bindings" ;;
                "show:inspect") echo "System inspection and available actions" ;;
                "configure:demo") echo "Configure demo application settings" ;;
                "configure:colors") echo "Adjust color palettes and themes" ;;
                "configure:input") echo "Customize input handling and navigation" ;;
                "configure:tui") echo "Configure TUI framework settings" ;;
                "test:demo") echo "Run demo system validation tests" ;;
                "test:colors") echo "Test color system functionality" ;;
                "test:input") echo "Validate input handling system" ;;
                "test:tui") echo "Test TUI framework components" ;;
                *) echo "Action: $verb:$noun" ;;
            esac
        fi
    }
    export -f get_action_description
fi

# Mode functions
if ! command -v get_current_modes >/dev/null 2>&1; then
    get_current_modes() {
        if [[ "$HANDLER_CONTEXT" == "app" ]] && command -v _get_current_modes >/dev/null 2>&1; then
            _get_current_modes
        else
            # Default modes for standalone
            echo "Learn Try Tui Test"
        fi
    }
    export -f get_current_modes
fi

if ! command -v get_actions >/dev/null 2>&1; then
    get_actions() {
        if [[ "$HANDLER_CONTEXT" == "app" ]] && command -v _get_actions >/dev/null 2>&1; then
            _get_actions
        else
            # Default actions for standalone
            echo -e "show:demo\nshow:colors\nshow:input\nshow:tui\nshow:inspect"
        fi
    }
    export -f get_actions
fi

# Noun and verb discovery functions
if ! command -v get_env_nouns >/dev/null 2>&1; then
    get_env_nouns() {
        local env="$1"

        if [[ "$HANDLER_CONTEXT" == "app" ]] && command -v _get_env_nouns >/dev/null 2>&1; then
            _get_env_nouns "$env"
        else
            # Default nouns for standalone
            case "$env" in
                "DEV") echo -e "demo\ncolors\ninput\ntui\nModule\ninspect" ;;
                *) echo -e "demo\ncolors\ninput\ntui" ;;
            esac
        fi
    }
    export -f get_env_nouns
fi

if ! command -v get_mode_verbs >/dev/null 2>&1; then
    get_mode_verbs() {
        local mode="$1"

        if [[ "$HANDLER_CONTEXT" == "app" ]] && command -v _get_mode_verbs >/dev/null 2>&1; then
            _get_mode_verbs "$mode"
        else
            # Default verbs for standalone
            case "$mode" in
                "Learn") echo "show" ;;
                "Try") echo -e "show\nconfigure" ;;
                "Tui"|"Test") echo -e "show\nconfigure\ntest" ;;
                *) echo -e "show\nconfigure\ntest" ;;
            esac
        fi
    }
    export -f get_mode_verbs
fi

# Logging functions
if ! command -v log_action >/dev/null 2>&1; then
    log_action() {
        if [[ "$HANDLER_CONTEXT" == "app" ]] && command -v _log_action >/dev/null 2>&1; then
            _log_action "$@"
        elif [[ "${DEBUG:-}" == "true" ]]; then
            echo "LOG: $*" >&2
        fi
        # Standalone: silent by default
    }
    export -f log_action
fi

if ! command -v handler_log >/dev/null 2>&1; then
    handler_log() {
        local level="$1"
        shift

        if [[ "$HANDLER_CONTEXT" == "app" ]] && command -v _handler_log >/dev/null 2>&1; then
            _handler_log "$level" "$@"
        elif [[ "${DEBUG:-}" == "true" ]]; then
            echo "HANDLER[$level]: $*" >&2
        fi
        # Standalone: silent by default
    }
    export -f handler_log
fi

# Set handler context when in app
set_handler_app_context() {
    export HANDLER_CONTEXT="app"

    # If app versions exist, make them available with _ prefix
    if command -v refresh_color_state_cached >/dev/null 2>&1; then
        eval "_$(declare -f refresh_color_state_cached)"
    fi
    if command -v get_action_routing >/dev/null 2>&1; then
        eval "_$(declare -f get_action_routing)"
    fi
    # Add more app function backups as needed
}

# Initialize dependencies
init_handler_dependencies() {
    # All functions are exported above, just set context
    if [[ "${BASH_SOURCE[0]}" == *"/bash/app/"* ]]; then
        set_handler_app_context
    fi
}