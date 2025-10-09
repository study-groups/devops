#!/usr/bin/env bash

# Demo 010 - Sourceable Function Library
# Usage: source demo.sh && demo <command>
#
# This provides a clean demo <cmd> interface for managing both
# the TUI application and web dashboard from the current shell.

# Demo configuration
DEMO_VERSION="010"
DEMO_NAME="Tetra TUI Framework Demo"

# Environment variable validation and setup
if [[ -z "$DEMO_SRC" ]]; then
    export DEMO_SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    echo "⚠️  DEMO_SRC not set, defaulting to: $DEMO_SRC"
fi

if [[ -z "$DEMO_DIR" ]]; then
    export DEMO_DIR="$DEMO_SRC"
    echo "⚠️  DEMO_DIR not set, defaulting to: $DEMO_DIR"
fi

# Validate paths exist
if [[ ! -d "$DEMO_SRC" ]]; then
    echo "❌ Error: DEMO_SRC directory does not exist: $DEMO_SRC" >&2
    return 1
fi

if [[ ! -d "$DEMO_SRC/bash" ]]; then
    echo "❌ Error: bash directory not found in DEMO_SRC: $DEMO_SRC/bash" >&2
    return 1
fi

# Colors for demo output
DEMO_BLUE='\033[0;34m'
DEMO_GREEN='\033[0;32m'
DEMO_YELLOW='\033[1;33m'
DEMO_RED='\033[0;31m'
DEMO_NC='\033[0m' # No Color

# Source required modules
# Note: We'll source modules on-demand to avoid initialization conflicts

# Web server state management (simplified for demo.sh)
WEB_SERVER_PORT=8080
WEB_SERVER_PID_FILE="/tmp/tetra_demo_server.pid"

# Check if web server is running
demo_is_web_server_running() {
    if [[ -f "$WEB_SERVER_PID_FILE" ]]; then
        local pid=$(cat "$WEB_SERVER_PID_FILE" 2>/dev/null)
        if [[ -n "$pid" ]] && kill -0 $pid 2>/dev/null; then
            return 0
        else
            rm -f "$WEB_SERVER_PID_FILE"
        fi
    fi
    return 1
}

# Initialize demo environment
demo_init() {
    export DEMO_SRC
    export DEMO_DIR
    export DEMO_VERSION
    export DEMO_NAME

    echo -e "${DEMO_BLUE}$DEMO_NAME v$DEMO_VERSION loaded${DEMO_NC}"
    echo -e "📁 DEMO_SRC: $DEMO_SRC"
    echo -e "📁 DEMO_DIR: $DEMO_DIR"
    echo -e "Type ${DEMO_GREEN}demo help${DEMO_NC} for available commands"
}

# Main demo command function
demo() {
    case "${1:-help}" in
        "help"|"-h"|"--help")
            demo_help
            ;;
        "repl")
            demo_repl
            ;;
        "app")
            demo_app
            ;;
        "web")
            demo_web "${@:2}"
            ;;
        "test")
            demo_test
            ;;
        "inspect")
            demo_inspect
            ;;
        "version")
            demo_version
            ;;
        "status")
            demo_status
            ;;
        *)
            echo -e "${DEMO_RED}Unknown command: $1${DEMO_NC}"
            echo -e "Type ${DEMO_GREEN}demo help${DEMO_NC} for available commands"
            return 1
            ;;
    esac
}

# Show comprehensive help
demo_help() {
    echo -e "${DEMO_BLUE}$DEMO_NAME v$DEMO_VERSION${DEMO_NC}"
    echo -e "${DEMO_BLUE}================================${DEMO_NC}"
    echo
    echo -e "${DEMO_GREEN}Usage:${DEMO_NC} demo <command> [options]"
    echo
    echo -e "${DEMO_YELLOW}🎮 Application Commands:${DEMO_NC}"
    echo "  app                   Launch full TUI application"
    echo "  repl                  Enter standalone REPL mode"
    echo
    echo -e "${DEMO_YELLOW}🌐 Web Dashboard Commands:${DEMO_NC}"
    echo "  web start [port]      Start web dashboard server (default: 8080)"
    echo "  web stop              Stop web dashboard server"
    echo "  web status            Show web server status"
    echo "  web restart [port]    Restart web server"
    echo "  web open              Open dashboard in browser"
    echo "  web refresh           Regenerate module discovery data"
    echo
    echo -e "${DEMO_YELLOW}🔧 System Commands:${DEMO_NC}"
    echo "  test                  Run test suite"
    echo "  inspect               Show detailed system state"
    echo "  status                Show quick status overview"
    echo "  version               Show version information"
    echo "  help                  Show this help"
    echo
    echo -e "${DEMO_YELLOW}📚 Examples:${DEMO_NC}"
    echo "  demo app              # Launch full TUI interface"
    echo "  demo web start        # Start dashboard on port 8080"
    echo "  demo web start 3000   # Start dashboard on port 3000"
    echo "  demo repl             # Quick REPL with web server commands"
    echo
}

# Launch standalone REPL
demo_repl() {
    echo -e "${DEMO_BLUE}Launching Demo REPL...${DEMO_NC}"
    echo "Enhanced REPL with web server management commands"
    echo "Type 'help' in REPL for available commands, 'exit' to return"
    echo

    # Change to demo source directory for proper paths
    local original_dir="$PWD"
    cd "$DEMO_SRC"

    # Launch the app in standalone REPL mode
    if bash "$DEMO_SRC/bash/app/app.sh" repl; then
        echo -e "${DEMO_GREEN}REPL session completed${DEMO_NC}"
    else
        echo -e "${DEMO_RED}REPL session failed${DEMO_NC}"
    fi

    cd "$original_dir"
}

# Launch full TUI application
demo_app() {
    echo -e "${DEMO_BLUE}Launching Full TUI Application...${DEMO_NC}"
    echo "Starting complete TUI interface with gamepad mode and REPL"
    echo

    local original_dir="$PWD"
    cd "$DEMO_SRC"

    # Launch the full TUI app
    if bash "$DEMO_SRC/bash/app/app.sh"; then
        echo -e "${DEMO_GREEN}TUI application completed${DEMO_NC}"
    else
        local exit_code=$?
        if [[ $exit_code -eq 42 ]]; then
            echo -e "${DEMO_YELLOW}TUI application restarting...${DEMO_NC}"
            demo_app  # Recursive restart
        else
            echo -e "${DEMO_RED}TUI application failed (exit code: $exit_code)${DEMO_NC}"
        fi
    fi

    cd "$original_dir"
}

# Web server management
demo_web() {
    local cmd="${1:-status}"

    case "$cmd" in
        "start")
            local port="${2:-8080}"
            demo_web_start "$port"
            ;;
        "stop")
            demo_web_stop
            ;;
        "status")
            demo_web_status
            ;;
        "restart")
            local port="${2:-$WEB_SERVER_PORT}"
            demo_web_stop
            sleep 1
            demo_web_start "$port"
            ;;
        "open")
            demo_web_open
            ;;
        "refresh")
            demo_web_refresh
            ;;
        *)
            echo -e "${DEMO_RED}Unknown web command: $cmd${DEMO_NC}"
            echo "Available: start [port], stop, status, restart [port], open, refresh"
            return 1
            ;;
    esac
}

# Start web server
demo_web_start() {
    local port="${1:-8080}"

    if demo_is_web_server_running; then
        echo -e "${DEMO_YELLOW}⚠️  Web server already running on port $WEB_SERVER_PORT${DEMO_NC}"
        echo -e "📱 Dashboard: http://localhost:$WEB_SERVER_PORT/web/dashboard.html"
        return 1
    fi

    echo -e "${DEMO_BLUE}🚀 Starting web server on port $port...${DEMO_NC}"

    # Generate fresh AST data
    bash "$DEMO_SRC/bash/utils/generate_ast_json.sh" >/dev/null 2>&1

    # Start server in background
    cd "$DEMO_SRC"
    python3 -m http.server $port > /dev/null 2>&1 &
    local pid=$!

    # Save PID and port
    echo $pid > "$WEB_SERVER_PID_FILE"
    WEB_SERVER_PORT=$port

    # Wait and check if started
    sleep 1
    if kill -0 $pid 2>/dev/null; then
        echo -e "${DEMO_GREEN}✅ Web server started successfully${DEMO_NC}"
        echo -e "${DEMO_GREEN}📱 Dashboard: http://localhost:$port/web/dashboard.html${DEMO_NC}"
    else
        echo -e "${DEMO_RED}❌ Failed to start web server${DEMO_NC}"
        rm -f "$WEB_SERVER_PID_FILE"
        return 1
    fi
}

# Stop web server
demo_web_stop() {
    if ! demo_is_web_server_running; then
        echo -e "${DEMO_YELLOW}⚠️  Web server is not running${DEMO_NC}"
        return 1
    fi

    local pid=$(cat "$WEB_SERVER_PID_FILE" 2>/dev/null)
    if [[ -n "$pid" ]] && kill -0 $pid 2>/dev/null; then
        echo -e "${DEMO_BLUE}🛑 Stopping web server (PID: $pid)...${DEMO_NC}"
        kill $pid
        rm -f "$WEB_SERVER_PID_FILE"
        echo -e "${DEMO_GREEN}✅ Web server stopped${DEMO_NC}"
    else
        echo -e "${DEMO_RED}❌ Could not stop server (invalid PID)${DEMO_NC}"
        rm -f "$WEB_SERVER_PID_FILE"
    fi
}

# Show web server status
demo_web_status() {
    if demo_is_web_server_running; then
        local pid=$(cat "$WEB_SERVER_PID_FILE" 2>/dev/null)
        echo -e "${DEMO_GREEN}✅ Web server is running${DEMO_NC}"
        echo "  PID: $pid"
        echo "  Port: $WEB_SERVER_PORT"
        echo "  URL: http://localhost:$WEB_SERVER_PORT/web/dashboard.html"
    else
        echo -e "${DEMO_RED}❌ Web server is not running${DEMO_NC}"
        echo "  Use 'demo web start [port]' to start server"
    fi
}

# Open web dashboard
demo_web_open() {
    if ! demo_is_web_server_running; then
        echo -e "${DEMO_RED}❌ Web server is not running. Start it first with 'demo web start'${DEMO_NC}"
        return 1
    fi

    if command -v open >/dev/null 2>&1; then
        open "http://localhost:$WEB_SERVER_PORT/web/dashboard.html"
        echo -e "${DEMO_GREEN}🌐 Opening dashboard in browser...${DEMO_NC}"
    else
        echo -e "${DEMO_BLUE}🌐 Open manually: http://localhost:$WEB_SERVER_PORT/web/dashboard.html${DEMO_NC}"
    fi
}

# Refresh web data
demo_web_refresh() {
    echo -e "${DEMO_BLUE}🔄 Refreshing web dashboard data...${DEMO_NC}"
    if bash "$DEMO_SRC/bash/utils/generate_ast_json.sh" >/dev/null 2>&1; then
        echo -e "${DEMO_GREEN}✅ Web dashboard data refreshed${DEMO_NC}"
    else
        echo -e "${DEMO_RED}❌ Failed to refresh web dashboard data${DEMO_NC}"
    fi
}

# Run test suite
demo_test() {
    echo -e "${DEMO_BLUE}Running Demo Test Suite...${DEMO_NC}"

    local original_dir="$PWD"
    cd "$DEMO_SRC"

    if [[ -f "bash/utils/run_all_tests.sh" ]]; then
        bash bash/utils/run_all_tests.sh
    else
        echo -e "${DEMO_YELLOW}No test suite found. Looking for test files...${DEMO_NC}"
        find tests/ -name "*.sh" -type f 2>/dev/null | head -5 | while read -r test_file; do
            echo "  Found: $test_file"
        done
    fi

    cd "$original_dir"
}

# Show detailed system inspection
demo_inspect() {
    echo -e "${DEMO_BLUE}Demo System Inspection${DEMO_NC}"
    echo -e "${DEMO_BLUE}====================${DEMO_NC}"
    echo

    # Demo info
    echo -e "${DEMO_YELLOW}📍 Demo Information:${DEMO_NC}"
    echo "  Name: $DEMO_NAME"
    echo "  Version: $DEMO_VERSION"
    echo "  DEMO_SRC: $DEMO_SRC"
    echo "  DEMO_DIR: $DEMO_DIR"
    echo "  Current Dir: $PWD"
    echo

    # Web server status
    echo -e "${DEMO_YELLOW}🌐 Web Server:${DEMO_NC}"
    if demo_is_web_server_running; then
        local pid=$(cat "$WEB_SERVER_PID_FILE" 2>/dev/null)
        echo "  Status: ✅ Running (PID: $pid)"
        echo "  Port: $WEB_SERVER_PORT"
        echo "  URL: http://localhost:$WEB_SERVER_PORT/web/dashboard.html"
    else
        echo "  Status: ❌ Not running"
        echo "  Last Port: $WEB_SERVER_PORT"
    fi
    echo

    # File structure
    echo -e "${DEMO_YELLOW}📂 Key Files:${DEMO_NC}"
    echo "  Demo Controller: $(test -f "$DEMO_SRC/demo.sh" && echo "✅" || echo "❌") $DEMO_SRC/demo.sh"
    echo "  TUI App: $(test -f "$DEMO_SRC/bash/app/app.sh" && echo "✅" || echo "❌") bash/app/app.sh"
    echo "  REPL Module: $(test -f "$DEMO_SRC/bash/app/repl.sh" && echo "✅" || echo "❌") bash/app/repl.sh"
    echo "  Web Dashboard: $(test -f "$DEMO_SRC/web/dashboard.html" && echo "✅" || echo "❌") web/dashboard.html"
    echo "  AST Data: $(test -f "$DEMO_SRC/web/api/modules.json" && echo "✅" || echo "❌") web/api/modules.json"
    echo

    # Module counts
    if [[ -f "$DEMO_SRC/web/api/modules.json" ]]; then
        local module_count=$(grep -c '"type":' "$DEMO_SRC/web/api/modules.json" 2>/dev/null || echo "unknown")
        echo -e "${DEMO_YELLOW}📊 Discovered Modules:${DEMO_NC} $module_count"
    fi
}

# Show quick status overview
demo_status() {
    # Check web server
    local web_status="❌ Not running"
    if demo_is_web_server_running; then
        web_status="✅ Running on port $WEB_SERVER_PORT"
    fi

    # Count modules
    local modules="unknown"
    if [[ -f "$DEMO_SRC/web/api/modules.json" ]]; then
        modules=$(grep -c '"type":' "$DEMO_SRC/web/api/modules.json" 2>/dev/null || echo "unknown")
    fi

    echo -e "${DEMO_BLUE}$DEMO_NAME v$DEMO_VERSION${DEMO_NC}"
    echo "Web Server: $web_status"
    echo "Modules: $modules discovered"
    echo "DEMO_SRC: $DEMO_SRC"
    echo "DEMO_DIR: $DEMO_DIR"
}

# Show version information
demo_version() {
    echo -e "${DEMO_BLUE}$DEMO_NAME${DEMO_NC}"
    echo "Version: $DEMO_VERSION"
    echo "DEMO_SRC: $DEMO_SRC"
    echo "DEMO_DIR: $DEMO_DIR"
    echo "Framework: Tetra TUI + Web Dashboard"
}

# Auto-initialize when sourced (not when executed)
if [[ "${BASH_SOURCE[0]}" != "${0}" ]]; then
    demo_init
fi