#!/usr/bin/env bash
# CDP Module TCS-Compliant Actions
# Follows Tetra Module Convention 2.0 and TCS 3.0

# Import CDP functionality
: "${CDP_SRC:=$TETRA_SRC/bash/rag/cdp}"
source "$CDP_SRC/cdp.sh" 2>/dev/null || true

# Register CDP actions with TUI
cdp_register_actions() {
    # Ensure declare_action exists (from demo 014/013)
    if ! declare -f declare_action >/dev/null 2>&1; then
        echo "Warning: declare_action not available" >&2
        return 1
    fi

    # Launch Chrome with remote debugging
    declare_action "launch_chrome" \
        "verb=launch" \
        "noun=chrome" \
        "exec_at=@local" \
        "contexts=Local" \
        "modes=Execute" \
        "tes_operation=local" \
        "inputs=port" \
        "effects=@local[chrome process]" \
        "immediate=false" \
        "can=Launch Chrome/Chromium with CDP enabled" \
        "cannot=Control existing Chrome instances"

    # Navigate to URL
    declare_action "navigate_url" \
        "verb=navigate" \
        "noun=url" \
        "exec_at=@local" \
        "contexts=Local" \
        "modes=Execute" \
        "tes_operation=local" \
        "inputs=url" \
        "output=@tui[status]" \
        "effects=@cdp[db/timestamp.action.json]" \
        "immediate=false" \
        "can=Navigate browser to URL via CDP" \
        "cannot=Navigate without active CDP connection"

    # Take screenshot
    declare_action "screenshot_page" \
        "verb=screenshot" \
        "noun=page" \
        "exec_at=@local" \
        "contexts=Local" \
        "modes=Inspect" \
        "tes_operation=local" \
        "output=@cdp[db/timestamp.screenshot.png]" \
        "effects=@cdp[db/]" \
        "immediate=true" \
        "can=Capture page screenshot via CDP" \
        "cannot=Screenshot without active CDP connection"

    # Execute JavaScript
    declare_action "execute_js" \
        "verb=execute" \
        "noun=javascript" \
        "exec_at=@local" \
        "contexts=Local" \
        "modes=Execute" \
        "tes_operation=local" \
        "inputs=js_code" \
        "output=@tui[content]" \
        "immediate=false" \
        "can=Execute JavaScript in page context" \
        "cannot=Execute without active CDP connection"

    # Extract text by selector
    declare_action "extract_text" \
        "verb=extract" \
        "noun=text" \
        "exec_at=@local" \
        "contexts=Local" \
        "modes=Inspect" \
        "tes_operation=local" \
        "inputs=selector" \
        "output=@tui[content]" \
        "immediate=true" \
        "can=Extract text from elements by CSS selector" \
        "cannot=Extract without active CDP connection"

    # Get page HTML
    declare_action "get_html" \
        "verb=get" \
        "noun=html" \
        "exec_at=@local" \
        "contexts=Local" \
        "modes=Inspect" \
        "tes_operation=local" \
        "output=@cdp[db/timestamp.page.html]" \
        "effects=@cdp[db/]" \
        "immediate=true" \
        "can=Get full page HTML via CDP DOM API" \
        "cannot=Get HTML without active CDP connection"

    # Click element
    declare_action "click_element" \
        "verb=click" \
        "noun=element" \
        "exec_at=@local" \
        "contexts=Local" \
        "modes=Execute" \
        "tes_operation=local" \
        "inputs=selector" \
        "output=@tui[status]" \
        "immediate=false" \
        "can=Click element by CSS selector" \
        "cannot=Click without active CDP connection"

    # Type into element
    declare_action "type_text" \
        "verb=type" \
        "noun=text" \
        "exec_at=@local" \
        "contexts=Local" \
        "modes=Execute" \
        "tes_operation=local" \
        "inputs=selector,text" \
        "output=@tui[status]" \
        "immediate=false" \
        "can=Type text into input element" \
        "cannot=Type without active CDP connection"

    # Connect to CDP
    declare_action "connect_cdp" \
        "verb=connect" \
        "noun=cdp" \
        "exec_at=@local" \
        "contexts=Local" \
        "modes=Execute" \
        "tes_operation=local" \
        "inputs=port" \
        "output=@tui[status]" \
        "effects=@cdp[state]" \
        "immediate=true" \
        "can=Connect to Chrome DevTools Protocol" \
        "cannot=Connect without Chrome running"

    # Disconnect from CDP
    declare_action "disconnect_cdp" \
        "verb=disconnect" \
        "noun=cdp" \
        "exec_at=@local" \
        "contexts=Local" \
        "modes=Execute" \
        "tes_operation=local" \
        "output=@tui[status]" \
        "effects=@cdp[state]" \
        "immediate=true" \
        "can=Disconnect from CDP session" \
        "cannot=Nothing - safe to call anytime"

    # Kill Chrome process
    declare_action "kill_chrome" \
        "verb=kill" \
        "noun=chrome" \
        "exec_at=@local" \
        "contexts=Local" \
        "modes=Execute" \
        "tes_operation=local" \
        "output=@tui[status]" \
        "effects=@local[chrome process]" \
        "immediate=false" \
        "can=Terminate Chrome process launched by CDP" \
        "cannot=Kill external Chrome instances"

    # Initialize CDP module
    declare_action "init_cdp" \
        "verb=init" \
        "noun=cdp" \
        "exec_at=@local" \
        "contexts=Local" \
        "modes=Execute" \
        "tes_operation=local" \
        "output=@tui[status]" \
        "effects=@cdp[directories]" \
        "immediate=true" \
        "can=Initialize CDP directory structure" \
        "cannot=Nothing - safe to call multiple times"
}

# Execute CDP actions
cdp_execute_action() {
    local action="$1"
    shift
    local args=("$@")

    case "$action" in
        launch:chrome)
            local port="${args[0]:-9222}"
            cdp_init
            cdp_launch_chrome "$port"
            ;;

        navigate:url)
            local url="${args[0]}"
            if [[ -z "$url" ]]; then
                echo "Error: URL required"
                return 1
            fi
            cdp_navigate "$url"
            ;;

        screenshot:page)
            local timestamp="${args[0]:-}"
            cdp_screenshot "$timestamp"
            ;;

        execute:javascript)
            local js_code="${args[0]}"
            if [[ -z "$js_code" ]]; then
                echo "Error: JavaScript code required"
                return 1
            fi
            cdp_execute "$js_code"
            ;;

        extract:text)
            local selector="${args[0]}"
            if [[ -z "$selector" ]]; then
                echo "Error: CSS selector required"
                return 1
            fi
            cdp_extract "$selector"
            ;;

        get:html)
            local timestamp="${args[0]:-}"
            cdp_get_html "$timestamp"
            ;;

        click:element)
            local selector="${args[0]}"
            if [[ -z "$selector" ]]; then
                echo "Error: CSS selector required"
                return 1
            fi
            cdp_click "$selector"
            ;;

        type:text)
            local selector="${args[0]}"
            local text="${args[1]}"
            if [[ -z "$selector" ]] || [[ -z "$text" ]]; then
                echo "Error: Selector and text required"
                return 1
            fi
            cdp_type "$selector" "$text"
            ;;

        connect:cdp)
            local port="${args[0]:-9222}"
            cdp_connect "$port"
            ;;

        disconnect:cdp)
            cdp_disconnect
            ;;

        kill:chrome)
            cdp_kill_chrome
            ;;

        init:cdp)
            cdp_init
            ;;

        *)
            echo "Unknown action: $action"
            return 1
            ;;
    esac
}

# Export for discovery
export -f cdp_register_actions
export -f cdp_execute_action
