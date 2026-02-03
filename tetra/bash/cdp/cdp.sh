#!/usr/bin/env bash
# cdp.sh - Chrome DevTools Protocol wrapper for debug workflows
#
# Type Contracts (TCS 3.0):
#   cdp.connect :: (port:int) → Session[websocket]
#     where Effect[state]
#
#   cdp.navigate :: (url:string) → Event[loadEventFired]
#     where Effect[browser, log]
#
#   cdp.screenshot :: () → @cdp:timestamp.screenshot.png
#     where Effect[cache, db]
#
#   cdp.execute :: (js:string) → Result[json]
#     where Effect[browser, log]
#
#   cdp.extract :: (selector:string) → Text[stdout]
#     where Effect[browser]

# Source paths module
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/cdp_paths.sh"
source "$SCRIPT_DIR/cdp_session.sh"

# CDP WebSocket connection state (runtime variables)
CDP_WS_URL=""
CDP_WS_PID=""
CDP_SESSION_ID=""
CDP_MESSAGE_ID=1

# CDP default port
: "${CDP_PORT:=9222}"

# Load active profile
cdp_load_active_profile() {
    local profile_name="${1:-default}"

    local user_profile="$(cdp_get_user_profiles_dir)/$profile_name.conf"
    local system_profile="$(cdp_get_profiles_dir)/$profile_name.conf"

    if [[ -f "$user_profile" ]]; then
        source "$user_profile"
    elif [[ -f "$system_profile" ]]; then
        source "$system_profile"
    else
        echo "Warning: Profile '$profile_name' not found, using defaults" >&2
    fi
}

# Get Chrome/Chromium binary path
cdp_get_chrome_binary() {
    local chrome_paths=(
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
        "/Applications/Chromium.app/Contents/MacOS/Chromium"
        "$(which google-chrome 2>/dev/null)"
        "$(which chromium 2>/dev/null)"
        "$(which chromium-browser 2>/dev/null)"
    )

    for path in "${chrome_paths[@]}"; do
        if [[ -n "$path" ]] && [[ -x "$path" ]]; then
            echo "$path"
            return 0
        fi
    done

    echo "Error: Chrome/Chromium not found" >&2
    return 1
}

# Launch Chrome with remote debugging (headed mode for debug)
cdp_launch_chrome() {
    local port="${1:-$CDP_PORT}"
    local user_data_dir="${2:-$(cdp_get_chrome_profile_dir)}"
    local headless="${3:-false}"

    local chrome_bin
    chrome_bin=$(cdp_get_chrome_binary) || return 1

    echo "Launching Chrome with remote debugging on port $port..."
    echo "User data dir: $user_data_dir"

    local chrome_args=(
        --remote-debugging-port="$port"
        --user-data-dir="$user_data_dir"
        --no-first-run
        --no-default-browser-check
    )

    if [[ "$headless" == "true" ]]; then
        chrome_args+=(--headless=new --disable-gpu)
    fi

    "$chrome_bin" "${chrome_args[@]}" \
        > "$(cdp_get_logs_dir)/chrome.log" 2>&1 &

    local chrome_pid=$!

    # Wait for Chrome to be ready
    local retries=10
    while [[ $retries -gt 0 ]]; do
        if curl -s "http://localhost:$port/json/version" >/dev/null 2>&1; then
            echo "Chrome ready (PID: $chrome_pid)"
            echo "$chrome_pid" > "$(cdp_get_config_dir)/chrome.pid"
            return 0
        fi
        sleep 0.5
        retries=$((retries - 1))
    done

    echo "Error: Chrome failed to start" >&2
    return 1
}

# Get CDP WebSocket URL
cdp_get_ws_url() {
    local port="${1:-$CDP_PORT}"
    curl -s "http://localhost:$port/json/version" | \
        grep -o '"webSocketDebuggerUrl":"[^"]*"' | \
        cut -d'"' -f4
}

# Connect to CDP (TES-Agent lifecycle method)
cdp_connect() {
    local port="${1:-$CDP_PORT}"

    if [[ -z "${AGENT_NAME:-}" ]]; then
        cdp_load_active_profile
    fi

    if cdp_is_connected; then
        local existing_url=$(cdp_get_session_ws_url)
        echo "Already connected to CDP: $existing_url"
        CDP_WS_URL="$existing_url"
        CDP_SESSION_ID=$(cdp_get_session_id)
        return 0
    fi

    if ! curl -s "http://localhost:$port/json/version" >/dev/null 2>&1; then
        echo "Chrome not running, launching..."
        cdp_launch_chrome "$port" || return 1
    fi

    CDP_WS_URL=$(cdp_get_ws_url "$port")
    if [[ -z "$CDP_WS_URL" ]]; then
        echo "Error: Failed to get WebSocket URL" >&2
        return 1
    fi

    CDP_SESSION_ID=$(cdp_generate_timestamp)
    local chrome_pid=$(cat "$(cdp_get_config_dir)/chrome.pid" 2>/dev/null || echo "")

    cdp_mark_connected "$CDP_SESSION_ID" "$CDP_WS_URL" "$chrome_pid"

    echo "Connected to CDP: $CDP_WS_URL"
    echo "Session ID: $CDP_SESSION_ID"
    return 0
}

# Send CDP command (requires websocat or similar)
cdp_send_command() {
    local method="$1"
    shift
    local params="${1:-{}}"

    if [[ -z "$CDP_WS_URL" ]]; then
        echo "Error: Not connected to CDP" >&2
        return 1
    fi

    if ! command -v websocat >/dev/null 2>&1; then
        echo "Error: websocat not found. Install with: brew install websocat" >&2
        return 1
    fi

    local message_id=$CDP_MESSAGE_ID
    CDP_MESSAGE_ID=$((CDP_MESSAGE_ID + 1))

    local request
    request=$(jq -n \
        --argjson id "$message_id" \
        --arg method "$method" \
        --argjson params "$params" \
        '{id: $id, method: $method, params: $params}')

    echo "$request" | websocat -n1 "$CDP_WS_URL" 2>/dev/null
}

# Navigate to URL
cdp_navigate() {
    local url="$1"
    local timestamp=$(cdp_generate_timestamp)

    if [[ -z "$url" ]]; then
        echo "Error: URL required" >&2
        return 1
    fi

    echo "Navigating to: $url"

    cdp_send_command "Page.enable" "{}" >/dev/null

    local response
    response=$(cdp_send_command "Page.navigate" "{\"url\":\"$url\"}")

    local action_log=$(cdp_get_db_action_path "$timestamp")
    jq -n \
        --arg ts "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
        --arg action "navigate" \
        --arg url "$url" \
        --argjson response "$response" \
        '{timestamp: $ts, action: $action, url: $url, response: $response}' \
        > "$action_log"

    sleep 2
    echo "$response"
}

# Take screenshot
cdp_screenshot() {
    local timestamp="${1:-$(cdp_generate_timestamp)}"
    local output_path=$(cdp_get_db_screenshot_path "$timestamp")

    echo "Taking screenshot..."

    local response
    response=$(cdp_send_command "Page.captureScreenshot" "{\"format\":\"png\"}")

    if [[ -z "$response" ]]; then
        echo "Error: Failed to capture screenshot" >&2
        return 1
    fi

    echo "$response" | jq -r '.result.data' | base64 -d > "$output_path"

    if [[ -f "$output_path" ]]; then
        echo "Screenshot saved: $output_path"
        echo "$output_path"
        return 0
    else
        echo "Error: Failed to save screenshot" >&2
        return 1
    fi
}

# Execute JavaScript
cdp_execute() {
    local js_code="$1"

    if [[ -z "$js_code" ]]; then
        echo "Error: JavaScript code required" >&2
        return 1
    fi

    echo "Executing JavaScript..."

    local response
    response=$(cdp_send_command "Runtime.evaluate" \
        "{\"expression\":\"$js_code\",\"returnByValue\":true}")

    echo "$response" | jq -r '.result.result.value // .result.result'
}

# Get page HTML
cdp_get_html() {
    local timestamp="${1:-$(cdp_generate_timestamp)}"
    local output_path=$(cdp_get_db_html_path "$timestamp")

    echo "Getting page HTML..."

    local doc_response
    doc_response=$(cdp_send_command "DOM.getDocument" "{}")
    local root_node_id
    root_node_id=$(echo "$doc_response" | jq -r '.result.root.nodeId')

    if [[ -z "$root_node_id" ]] || [[ "$root_node_id" == "null" ]]; then
        echo "Error: Failed to get document root" >&2
        return 1
    fi

    local html_response
    html_response=$(cdp_send_command "DOM.getOuterHTML" "{\"nodeId\":$root_node_id}")

    echo "$html_response" | jq -r '.result.outerHTML' > "$output_path"

    if [[ -f "$output_path" ]]; then
        echo "HTML saved: $output_path"
        echo "$output_path"
        return 0
    else
        echo "Error: Failed to save HTML" >&2
        return 1
    fi
}

# Extract text by CSS selector
cdp_extract() {
    local selector="$1"

    if [[ -z "$selector" ]]; then
        echo "Error: CSS selector required" >&2
        return 1
    fi

    local js_code="Array.from(document.querySelectorAll('$selector')).map(el => el.textContent.trim()).join('\\n')"
    cdp_execute "$js_code"
}

# Click element by selector
cdp_click() {
    local selector="$1"

    if [[ -z "$selector" ]]; then
        echo "Error: CSS selector required" >&2
        return 1
    fi

    echo "Clicking element: $selector"
    local js_code="document.querySelector('$selector')?.click()"
    cdp_execute "$js_code"
}

# Type text into element
cdp_type() {
    local selector="$1"
    local text="$2"

    if [[ -z "$selector" ]] || [[ -z "$text" ]]; then
        echo "Error: Selector and text required" >&2
        return 1
    fi

    echo "Typing into element: $selector"
    local js_code="(() => { const el = document.querySelector('$selector'); if(el) { el.value = '$text'; el.dispatchEvent(new Event('input', {bubbles: true})); return true; } return false; })()"
    cdp_execute "$js_code"
}

# Disconnect from CDP (TES-Agent lifecycle method)
cdp_disconnect() {
    echo "Disconnecting from CDP..."

    cdp_mark_disconnected

    CDP_WS_URL=""
    CDP_SESSION_ID=""
    CDP_MESSAGE_ID=1

    return 0
}

# Kill Chrome instance
cdp_kill_chrome() {
    local pid_file="$(cdp_get_config_dir)/chrome.pid"

    if [[ -f "$pid_file" ]]; then
        local chrome_pid=$(cat "$pid_file")
        if kill -0 "$chrome_pid" 2>/dev/null; then
            echo "Killing Chrome (PID: $chrome_pid)..."
            kill "$chrome_pid"
            rm "$pid_file"
        else
            echo "Chrome process not running"
            rm "$pid_file"
        fi
    else
        echo "No Chrome PID file found"
    fi
}

# Initialize CDP module (TES-Agent lifecycle method)
cdp_init() {
    cdp_init_dirs
    cdp_load_active_profile

    echo "CDP agent initialized"
    echo "DB:     $(cdp_get_db_dir)"
    echo "Config: $(cdp_get_config_dir)"
    echo "Logs:   $(cdp_get_logs_dir)"
    echo "Cache:  $(cdp_get_cache_dir)"
    echo "Profile: $(cdp_get_profiles_dir)"

    return 0
}

# Execute CDP action (TES-Agent lifecycle method)
cdp_execute_action() {
    local action="$1"
    shift
    local args=("$@")

    if [[ "$action" != "init" ]] && [[ "$action" != "connect" ]]; then
        if ! cdp_is_connected; then
            echo "Error: CDP not connected. Run cdp_connect first." >&2
            return 1
        fi
    fi

    case "$action" in
        navigate)    cdp_navigate "${args[@]}" ;;
        screenshot)  cdp_screenshot "${args[@]}" ;;
        execute_js|execute) cdp_execute_js "${args[@]}" ;;
        extract)     cdp_extract "${args[@]}" ;;
        get_html|html) cdp_get_html "${args[@]}" ;;
        click)       cdp_click "${args[@]}" ;;
        type)        cdp_type "${args[@]}" ;;
        *)
            echo "Error: Unknown CDP action: $action" >&2
            return 1
            ;;
    esac
}

# Execute JavaScript (renamed to avoid conflict with cdp_execute)
cdp_execute_js() {
    local js_code="$1"

    if [[ -z "$js_code" ]]; then
        echo "Error: JavaScript code required" >&2
        return 1
    fi

    echo "Executing JavaScript..."

    local response
    response=$(cdp_send_command "Runtime.evaluate" \
        "{\"expression\":\"$js_code\",\"returnByValue\":true}")

    echo "$response" | jq -r '.result.result.value // .result.result'
}

# Cleanup CDP module (TES-Agent lifecycle method)
cdp_cleanup() {
    echo "Cleaning up CDP agent..."

    if cdp_is_connected; then
        cdp_disconnect
    fi

    local pid_file="$(cdp_get_config_dir)/chrome.pid"
    if [[ -f "$pid_file" ]]; then
        cdp_kill_chrome
    fi

    cdp_clear_session

    local cache_dir=$(cdp_get_cache_dir)
    if [[ -d "$cache_dir" ]]; then
        rm -rf "$cache_dir"/*
    fi

    echo "CDP agent cleanup complete"
    return 0
}

# Register as TES-Agent
if declare -f tetra_register_agent >/dev/null 2>&1; then
    tetra_register_agent "cdp" "protocol"
fi
