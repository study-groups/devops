#!/usr/bin/env bash

# Diskusage Module - Action Handlers
# Implements action execution for TView integration

# Source core functionality and providers
SCRIPT_DIR="$(dirname "${BASH_SOURCE[0]}")"
source "$SCRIPT_DIR/diskusage.sh"
source "$SCRIPT_DIR/providers.sh"

# Get actions available for specific environment
get_actions_for_env() {
    local env="${1:-LOCAL}"

    case "$env" in
        "LOCAL")
            echo "scan"
            echo "analyze"
            echo "cleanup"
            echo "report"
            echo "space"
            echo "help"
            ;;
        "REMOTE"|"DEV"|"STAGING"|"PROD"|"QA")
            echo "scan"
            echo "analyze"
            echo "report"
            echo "space"
            echo "help"
            ;;
        *)
            echo "scan"
            echo "help"
            ;;
    esac
}

# Main action handler
execute_action() {
    local action="$1"
    local env="${2:-LOCAL}"
    shift 2
    local args=("$@")

    case "$action" in
        "scan")
            handle_scan_action "$env" "${args[@]}"
            ;;
        "analyze")
            handle_analyze_action "$env" "${args[@]}"
            ;;
        "cleanup")
            handle_cleanup_action "$env" "${args[@]}"
            ;;
        "report")
            handle_report_action "$env" "${args[@]}"
            ;;
        "space")
            handle_space_action "$env" "${args[@]}"
            ;;
        "help")
            handle_help_action "$env"
            ;;
        *)
            echo "Unknown action: $action"
            echo "Available actions: $(get_actions_for_env "$env" | tr '\n' ' ')"
            return 1
            ;;
    esac
}

# Handle scan action - quick overview
handle_scan_action() {
    local env="$1"
    shift
    local args=("$@")

    local target_path="${args[0]:-.}"

    echo "🔍 Quick Disk Scan - $env"
    echo "Target: $target_path"
    echo ""

    if [[ "$env" == "LOCAL" ]]; then
        local total=$(get_disk_usage "$target_path" "human" 2>/dev/null)
        if [[ $? -eq 0 ]]; then
            echo "📊 Total Usage: $total"
            echo ""
            echo "🔝 Top 5 Items:"
            get_top_directories "$target_path" 5
        else
            echo "❌ Unable to scan directory: $target_path"
        fi
    else
        echo "📡 Remote scan would connect to $env and analyze disk usage"
        echo "💡 Use SSH commands: du -sh /target/path"
    fi
}

# Handle analyze action - detailed analysis
handle_analyze_action() {
    local env="$1"
    shift
    local args=("$@")

    local target_path="${args[0]:-.}"

    echo "🔬 Detailed Analysis - $env"
    echo "Target: $target_path"
    echo ""

    if [[ "$env" == "LOCAL" ]]; then
        echo "📊 Disk Usage Summary:"
        get_disk_usage "$target_path" "human"
        echo ""

        echo "🔝 Top 10 Directories:"
        get_top_directories "$target_path" 10
        echo ""

        echo "💾 Disk Space Info:"
        check_disk_space "$target_path"
    else
        echo "📡 Remote analysis would provide:"
        echo "• Detailed directory breakdown"
        echo "• File type analysis"
        echo "• Growth trends"
        echo "💡 Connect via SSH for full analysis"
    fi
}

# Handle cleanup action - remove temporary files
handle_cleanup_action() {
    local env="$1"
    shift
    local args=("$@")

    local target_path="${args[0]:-.}"
    local dry_run="${args[1]:-true}"

    echo "🧹 Cleanup Temporary Files - $env"
    echo "Target: $target_path"
    echo ""

    case "$env" in
        "LOCAL")
            cleanup_temp_files "$target_path" "$dry_run"
            ;;
        *)
            echo "❌ Cleanup not available for remote environments"
            echo "💡 For safety, cleanup is restricted to LOCAL environment"
            echo "💡 Use SSH manually for remote cleanup operations"
            ;;
    esac
}

# Handle report action - generate formatted report
handle_report_action() {
    local env="$1"
    shift
    local args=("$@")

    local target_path="${args[0]:-.}"
    local format="${args[1]:-text}"

    echo "📋 Disk Usage Report - $env"
    echo ""

    if [[ "$env" == "LOCAL" ]]; then
        generate_disk_report "$target_path" "$format"
    else
        echo "📡 Remote report generation for $env"
        echo "Target: $target_path"
        echo "Format: $format"
        echo ""
        echo "💡 Would generate comprehensive report via SSH"
        echo "💡 Including historical data and trends"
    fi
}

# Handle space action - check available space
handle_space_action() {
    local env="$1"
    shift
    local args=("$@")

    local target_path="${args[0]:-.}"

    echo "💾 Disk Space Check - $env"
    echo "Target: $target_path"
    echo ""

    if [[ "$env" == "LOCAL" ]]; then
        check_disk_space "$target_path"
        echo ""

        # Add some interpretation
        local usage_line=$(df "$target_path" | tail -n 1)
        local usage_percent=$(echo "$usage_line" | awk '{print $5}' | sed 's/%//')

        if [[ "$usage_percent" -gt 90 ]]; then
            echo "⚠️  WARNING: Disk usage above 90%"
        elif [[ "$usage_percent" -gt 80 ]]; then
            echo "⚠️  CAUTION: Disk usage above 80%"
        else
            echo "✅ Disk usage looks healthy"
        fi
    else
        echo "📡 Remote space check for $env"
        echo "💡 Would show disk usage via: df -h"
    fi
}

# Handle help action
handle_help_action() {
    local env="$1"

    get_module_help
    echo ""
    echo "🌍 Current Environment: $env"
    echo "📋 Available Actions: $(get_actions_for_env "$env" | tr '\n' ' ')"
    echo ""
    echo "💡 Usage: Execute actions with S key"
    echo "💡 Navigate: Use a/A keys to browse actions"
}