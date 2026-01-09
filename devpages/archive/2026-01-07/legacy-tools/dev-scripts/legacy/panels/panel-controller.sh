#!/bin/bash

# Panel Controller - Shell script for panel system management
# Usage: ./debug-scripts/panels/panel-controller.sh [command] [args...]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PANEL_INSPECTOR="$SCRIPT_DIR/panel-inspector.js"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if Node.js is available
check_node() {
    if ! command -v node &> /dev/null; then
        log_error "Node.js is required but not installed"
        exit 1
    fi
}

# Panel management functions
list_panels() {
    log_info "Listing all panels..."
    node "$PANEL_INSPECTOR" list
}

show_panel() {
    local panel_id="$1"
    if [[ -z "$panel_id" ]]; then
        log_error "Panel ID required"
        echo "Usage: $0 show <panel-id>"
        exit 1
    fi
    
    log_info "Showing panel: $panel_id"
    node "$PANEL_INSPECTOR" show "$panel_id"
}

create_panel() {
    local panel_type="$1"
    local config="$2"
    
    if [[ -z "$panel_type" ]]; then
        log_error "Panel type required"
        echo "Usage: $0 create <type> [config-json]"
        exit 1
    fi
    
    log_info "Creating panel of type: $panel_type"
    if [[ -n "$config" ]]; then
        node "$PANEL_INSPECTOR" create "$panel_type" "$config"
    else
        node "$PANEL_INSPECTOR" create "$panel_type"
    fi
}

destroy_panel() {
    local panel_id="$1"
    if [[ -z "$panel_id" ]]; then
        log_error "Panel ID required"
        echo "Usage: $0 destroy <panel-id>"
        exit 1
    fi
    
    log_warning "Destroying panel: $panel_id"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        node "$PANEL_INSPECTOR" destroy "$panel_id"
        log_success "Panel destroyed"
    else
        log_info "Operation cancelled"
    fi
}

show_status() {
    log_info "Panel system status..."
    node "$PANEL_INSPECTOR" status
}

export_panels() {
    local filename="$1"
    log_info "Exporting panels..."
    if [[ -n "$filename" ]]; then
        node "$PANEL_INSPECTOR" export "$filename"
    else
        node "$PANEL_INSPECTOR" export
    fi
}

import_panels() {
    local filename="$1"
    if [[ -z "$filename" ]]; then
        log_error "Filename required"
        echo "Usage: $0 import <filename>"
        exit 1
    fi
    
    if [[ ! -f "$filename" ]]; then
        log_error "File not found: $filename"
        exit 1
    fi
    
    log_info "Importing panels from: $filename"
    node "$PANEL_INSPECTOR" import "$filename"
}

# Development helpers
create_diagnostic_panel() {
    log_info "Creating diagnostic panel..."
    local config='{"title":"Diagnostic Panel","position":{"x":50,"y":50},"size":{"width":600,"height":400},"visible":true}'
    node "$PANEL_INSPECTOR" create "diagnostic" "$config"
}

create_test_panels() {
    log_info "Creating test panels..."
    
    # Create multiple test panels
    local panels=(
        "diagnostic:Diagnostic Panel"
        "log:Log Viewer"
        "component:Component Inspector"
        "network:Network Monitor"
    )
    
    for panel_def in "${panels[@]}"; do
        IFS=':' read -r type title <<< "$panel_def"
        local config="{\"title\":\"$title\",\"visible\":false}"
        node "$PANEL_INSPECTOR" create "$type" "$config"
        log_success "Created $type panel"
    done
}

cleanup_panels() {
    log_warning "This will remove ALL panels"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Get all panel IDs and remove them
        local panel_ids=$(node "$PANEL_INSPECTOR" list | grep "🔹" | awk '{print $2}')
        for panel_id in $panel_ids; do
            node "$PANEL_INSPECTOR" destroy "$panel_id"
        done
        log_success "All panels removed"
    else
        log_info "Operation cancelled"
    fi
}

# Browser integration helpers
open_browser_console() {
    log_info "Browser console commands for panel system:"
    echo ""
    echo "// Core panel management"
    echo "const panel = window.APP.panels.createPanel('diagnostic', {title: 'Test Panel'})"
    echo "panel.mount().show()"
    echo ""
    echo "// Panel utilities"
    echo "window.APP.panels.list()                   // List all panels with details"
    echo "window.APP.panels.createTest()             // Create a test panel"
    echo "window.APP.panels.cascade()                // Arrange panels in cascade"
    echo "window.APP.panels.showAll()                // Show all panels"
    echo "window.APP.panels.cleanup()                // Clean up test panels"
    echo ""
    echo "// Sidebar management"
    echo "window.APP.sidebar.switchToTag('debug')    // Switch to debug tag"
    echo "window.APP.sidebar.getCurrentTag()         // Get current active tag"
    echo "window.APP.sidebar.getTagPanels('settings') // Get panels for tag"
    echo ""
    echo "// Context management"
    echo "window.APP.sidebar.setContextMode('debug', 'mixed')  // Set context to mixed mode"
    echo "window.APP.sidebar.getActivePanels()                 // Get active panels in current context"
    echo "window.APP.sidebar.returnAllToSidebar()              // Return all panels to sidebar"
    echo "window.APP.sidebar.convertToFloating('panel-id')     // Convert stack panel to floating"
    echo ""
    echo "// Get help and debug info"
    echo "window.APP.panels.help()                   // Show all available commands"
    echo "window.APP.panels.getDebugInfo()           // Get system information"
    echo ""
    echo "// Redux state"
    echo "window.APP.services.store.getState().panels"
}

# Main command dispatcher
main() {
    check_node
    
    local command="$1"
    shift || true
    
    case "$command" in
        "list"|"ls")
            list_panels
            ;;
        "show"|"info")
            show_panel "$@"
            ;;
        "create"|"new")
            create_panel "$@"
            ;;
        "destroy"|"rm"|"delete")
            destroy_panel "$@"
            ;;
        "status"|"stat")
            show_status
            ;;
        "export")
            export_panels "$@"
            ;;
        "import")
            import_panels "$@"
            ;;
        "diagnostic")
            create_diagnostic_panel
            ;;
        "test")
            create_test_panels
            ;;
        "cleanup"|"clear")
            cleanup_panels
            ;;
        "console"|"browser")
            open_browser_console
            ;;
        "help"|"--help"|"-h"|"")
            echo "Panel Controller - Shell interface for panel system"
            echo ""
            echo "Usage: $0 <command> [args...]"
            echo ""
            echo "Commands:"
            echo "  list, ls                - List all panels"
            echo "  show, info <id>         - Show panel details"
            echo "  create, new <type> [cfg] - Create a new panel"
            echo "  destroy, rm <id>        - Destroy a panel"
            echo "  status, stat            - Show system status"
            echo "  export [file]           - Export configurations"
            echo "  import <file>           - Import configurations"
            echo "  diagnostic              - Create diagnostic panel"
            echo "  test                    - Create test panels"
            echo "  cleanup, clear          - Remove all panels"
            echo "  console, browser        - Show browser commands"
            echo "  help                    - Show this help"
            echo ""
            echo "Examples:"
            echo "  $0 list"
            echo "  $0 create diagnostic '{\"title\":\"Debug Panel\"}'"
            echo "  $0 show diagnostic-123456"
            echo "  $0 export my-panels.json"
            ;;
        *)
            log_error "Unknown command: $command"
            echo "Use '$0 help' for usage information"
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
