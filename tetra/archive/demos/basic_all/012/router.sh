#!/usr/bin/env bash

# Router - Routes action output to declared targets

# TUI Component Buffers
declare -gA TUI_BUFFERS=(
    [@tui[header]]=""
    [@tui[content]]=""
    [@tui[cli]]=""
    [@tui[footer]]=""
)

# App Streams (virtual, since real stdio renders TUI)
declare -ga APP_STDOUT_STREAM=()

# Route output to TUI component
route_to_tui() {
    local component="$1"
    local output="$2"

    TUI_BUFFERS["$component"]="$output"
}

# Route output to app stream
route_to_app_stream() {
    local stream="$1"
    local output="$2"

    case "$stream" in
        "@app[stdout]")
            APP_STDOUT_STREAM+=("$(date '+%H:%M:%S') $output")
            ;;
    esac
}

# Main routing function (handles comma-separated targets)
route_output() {
    local routes="$1"
    local output="$2"

    # Parse comma-separated routes
    IFS=',' read -ra route_list <<< "$routes"

    for route in "${route_list[@]}"; do
        # Trim whitespace
        route=$(echo "$route" | xargs)

        case "$route" in
            @tui[*])
                route_to_tui "$route" "$output"
                ;;
            @app[*])
                route_to_app_stream "$route" "$output"
                ;;
            *)
                # Unknown route, ignore
                :
                ;;
        esac
    done
}

# Route to primary output and effects
route_output_and_effects() {
    local output_target="$1"
    local effects_targets="$2"
    local content="$3"

    # Route to primary output
    if [[ -n "$output_target" ]]; then
        route_output "$output_target" "$content"
    fi

    # Route to effects (if any)
    if [[ -n "$effects_targets" ]]; then
        route_output "$effects_targets" "$content"
    fi
}

# Clear all buffers
clear_buffers() {
    TUI_BUFFERS[@tui[header]]=""
    TUI_BUFFERS[@tui[content]]=""
    TUI_BUFFERS[@tui[cli]]=""
    TUI_BUFFERS[@tui[footer]]=""
}

# Clear just content
clear_content() {
    TUI_BUFFERS[@tui[content]]=""
}

# Get app stream as text
get_app_stream() {
    local stream="$1"

    case "$stream" in
        "@app[stdout]")
            printf "%s\n" "${APP_STDOUT_STREAM[@]}"
            ;;
    esac
}
