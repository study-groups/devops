#!/usr/bin/env bash

# Diskusage Module - TView Provider Interface Implementation
# Implements the standard TView provider interface for diskusage functionality

# Source core functionality
SCRIPT_DIR="$(dirname "${BASH_SOURCE[0]}")"
source "$SCRIPT_DIR/diskusage.sh"

# Get available items for the diskusage module based on environment
get_module_items() {
    local env="${1:-LOCAL}"

    case "$env" in
        "LOCAL")
            # For local environment, show current directory and common paths
            echo "current_dir:Current Directory (.)"
            echo "home_dir:Home Directory (~)"
            echo "tmp_dir:Temp Directory (/tmp)"
            if [[ -d "/var/log" ]]; then
                echo "log_dir:Log Directory (/var/log)"
            fi
            ;;
        "REMOTE"|"DEV"|"STAGING"|"PROD"|"QA")
            # For remote environments, show common server paths
            echo "home_dir:Home Directory (~)"
            echo "var_dir:Var Directory (/var)"
            echo "tmp_dir:Temp Directory (/tmp)"
            echo "opt_dir:Opt Directory (/opt)"
            echo "srv_dir:Srv Directory (/srv)"
            ;;
        *)
            echo "current_dir:Current Directory (.)"
            ;;
    esac
}

# Get current status of the diskusage module
get_module_status() {
    local env="${1:-LOCAL}"

    case "$env" in
        "LOCAL")
            local current_usage=$(get_disk_usage "." "human" 2>/dev/null)
            local disk_info=$(check_disk_space "." 2>/dev/null | tail -n 1)

            if [[ -n "$current_usage" && -n "$disk_info" ]]; then
                echo "active - Current: $current_usage | Disk: $(echo "$disk_info" | awk '{print $4" free of "$2}')"
            else
                echo "active - Ready for analysis"
            fi
            ;;
        "REMOTE"|"DEV"|"STAGING"|"PROD"|"QA")
            echo "ready - Remote disk analysis available"
            ;;
        *)
            echo "unknown"
            ;;
    esac
}

# Get module capabilities based on environment
get_module_capabilities() {
    local env="${1:-LOCAL}"

    case "$env" in
        "LOCAL")
            echo "scan,analyze,cleanup,report,space_check"
            ;;
        "REMOTE"|"DEV"|"STAGING"|"PROD"|"QA")
            echo "scan,analyze,report,space_check"
            ;;
        *)
            echo "scan,analyze,report"
            ;;
    esac
}

# Get detailed information about a specific item
get_item_details() {
    local env="${1:-LOCAL}"
    local item_id="${2:-current_dir}"

    case "$item_id" in
        "current_dir")
            local path="."
            ;;
        "home_dir")
            local path="$HOME"
            ;;
        "tmp_dir")
            local path="/tmp"
            ;;
        "log_dir")
            local path="/var/log"
            ;;
        "var_dir")
            local path="/var"
            ;;
        "opt_dir")
            local path="/opt"
            ;;
        "srv_dir")
            local path="/srv"
            ;;
        *)
            local path="."
            ;;
    esac

    if [[ "$env" == "LOCAL" ]]; then
        get_disk_usage "$path" "human" 2>/dev/null || echo "Unable to access $path"
    else
        echo "Remote analysis - use scan action"
    fi
}

# Get module-specific configuration
get_module_config() {
    local env="${1:-LOCAL}"

    cat << EOF
{
    "environment": "$env",
    "scan_depth": "2",
    "cleanup_patterns": ["*.tmp", "*.temp", "*~", ".DS_Store"],
    "report_format": "text",
    "default_sort": "size_desc"
}
EOF
}

# Validate module requirements
validate_module_requirements() {
    local env="${1:-LOCAL}"
    local missing_tools=()

    # Check required tools
    for tool in du df find stat; do
        if ! command -v "$tool" >/dev/null 2>&1; then
            missing_tools+=("$tool")
        fi
    done

    if [[ ${#missing_tools[@]} -eq 0 ]]; then
        echo "✅ All required tools available"
        return 0
    else
        echo "❌ Missing tools: ${missing_tools[*]}"
        return 1
    fi
}

# Get module help information
get_module_help() {
    cat << EOF
📁 Diskusage Module Help
======================

🎯 Purpose: Analyze and manage disk space usage

📋 Available Actions:
• scan     - Quick disk usage scan
• analyze  - Detailed directory analysis
• cleanup  - Remove temporary files
• report   - Generate usage report
• space    - Check available disk space

🌍 Environment Support:
• LOCAL    - Full functionality including cleanup
• REMOTE   - Analysis and reporting (no cleanup)

💡 Usage Tips:
1. Use 'scan' for quick overview
2. Use 'analyze' for detailed breakdown
3. Use 'cleanup' to free up space (LOCAL only)
4. Use 'report' for formatted output

🔧 Requirements: du, df, find, stat commands
EOF
}