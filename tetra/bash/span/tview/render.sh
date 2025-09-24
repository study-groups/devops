#!/usr/bin/env bash

# Span TView Integration - Render functions for span management interface

# Source span modules
SPAN_DIR="$(dirname "$(dirname "${BASH_SOURCE[0]}")")"
source "$SPAN_DIR/span.sh"

# TETRA:SPAN - Global span management overview
render_span_tetra() {
    cat << EOF

$(colorize_mode "SPAN" "SPAN") - TETRA Multispan Management

📊 Global Span Stats:
   Total Cursors: $(span_count_all_cursors) | Active Multispans: $(span_count_multispans) | Stored Slots: $(span_count_stored_slots)

🎯 Stored Multispans:
$(span_render_storage_overview)

📁 Recent Activity:
$(span_render_recent_activity)

$(highlight_line "Span Storage Management" "$(is_current_item 0)" "$ACTION_VIEW_COLOR")
$(highlight_line "Create New Multispan" "$(is_current_item 1)" "$ACTION_CONFIG_COLOR")
$(highlight_line "Search Across All Spans" "$(is_current_item 2)" "$ACTION_SEARCH_COLOR")
$(highlight_line "Export/Import Spans" "$(is_current_item 3)" "$ACTION_DEPLOY_COLOR")

Environment: $(colorize_env "TETRA" "TETRA")
Execute: ${COLOR_BOLD}Enter${COLOR_RESET} to manage, ${COLOR_BOLD}1-9${COLOR_RESET} to load slot

EOF
}

# LOCAL:SPAN - Local file span analysis
render_span_local() {
    cat << EOF

$(colorize_mode "SPAN" "SPAN") - $(colorize_env "LOCAL" "LOCAL") File Analysis

📄 Current Directory Analysis:
$(span_analyze_current_dir)

🔍 Quick Actions:
$(highlight_line "Analyze TOML Files" "$(is_current_item 0)" "$ACTION_CONFIG_COLOR")
$(highlight_line "Scan Shell Scripts" "$(is_current_item 1)" "$ACTION_SERVICE_COLOR")
$(highlight_line "Find Functions" "$(is_current_item 2)" "$ACTION_SEARCH_COLOR")
$(highlight_line "Search Patterns" "$(is_current_item 3)" "$ACTION_VIEW_COLOR")

📋 Active Multispan: $(span_get_active_multispan)
$(span_render_active_multispan_preview)

Environment: $(colorize_env "LOCAL" "LOCAL")
Path: $(colorize_status "$(pwd)" "info")

EOF
}

# DEV:SPAN - Remote file analysis over SSH
render_span_dev() {
    local ssh_status=""
    if timeout 2 ssh -o ConnectTimeout=1 -o BatchMode=yes "${CURRENT_SSH_PREFIXES[dev_root]#ssh }" "echo 'ok'" >/dev/null 2>&1; then
        ssh_status="$(render_status_indicator "connected" "SSH Ready")"
    else
        ssh_status="$(render_status_indicator "disconnected" "SSH Failed")"
    fi

    cat << EOF

$(colorize_mode "SPAN" "SPAN") - $(colorize_env "DEV" "DEV") Remote Analysis

$(highlight_line "SSH Status: $ssh_status" "$(is_current_item 0)" "$(get_status_color "info")")
$(highlight_line "Remote Configuration Files" "$(is_current_item 1)" "$ACTION_CONFIG_COLOR")
$(highlight_line "Service Definitions" "$(is_current_item 2)" "$ACTION_SERVICE_COLOR")
$(highlight_line "Log Pattern Analysis" "$(is_current_item 3)" "$ACTION_VIEW_COLOR")

Server: $(colorize_env "${CURRENT_SSH_PREFIXES[dev_root]#ssh }" "DEV")
Execute: ${COLOR_BOLD}Enter${COLOR_RESET} to analyze remote files

EOF
}

# Helper functions for span rendering

span_count_all_cursors() {
    # Count cursors across all storage slots
    local total=0
    for slot in {1..9}; do
        local -n storage_ref="SPAN_STORAGE_${slot}"
        total=$((total + ${#storage_ref[@]}))
    done
    echo "$total"
}

span_count_multispans() {
    # Count active multispans (simplified - count non-empty storage slots)
    local count=0
    for slot in {1..9}; do
        local -n storage_ref="SPAN_STORAGE_${slot}"
        if [[ ${#storage_ref[@]} -gt 0 ]]; then
            ((count++))
        fi
    done
    echo "$count"
}

span_count_stored_slots() {
    local slots=()
    for slot in {1..9}; do
        local -n storage_ref="SPAN_STORAGE_${slot}"
        if [[ ${#storage_ref[@]} -gt 0 ]]; then
            slots+=("[$slot]")
        fi
    done
    echo "${slots[*]}"
}

span_render_storage_overview() {
    for slot in {1..9}; do
        local -n storage_ref="SPAN_STORAGE_${slot}"
        local count=${#storage_ref[@]}
        local desc="${SPAN_METADATA[$slot]:-empty}"

        if [[ $count -gt 0 ]]; then
            local indicator="●"
            if [[ $slot -eq ${CURRENT_ITEM:-0} ]]; then
                indicator="◉"  # Selected
            fi
            printf "[$slot] %s %s (%d cursors)\n" "$indicator" "$desc" "$count"
        else
            printf "[$slot] — (empty)\n"
        fi
    done
}

span_render_recent_activity() {
    echo "[ ] TOML Configuration Spans    (last modified: $(date '+%H:%M'))"
    echo "[●] Function Definitions        (3 files, 15 cursors)"
    echo "[ ] Error Log Patterns          (scanning...)"
}

span_analyze_current_dir() {
    local toml_count=$(find . -maxdepth 1 -name "*.toml" | wc -l)
    local sh_count=$(find . -maxdepth 1 -name "*.sh" | wc -l)
    local total_files=$((toml_count + sh_count))

    printf "Files: %d total (%d TOML, %d Shell)\n" "$total_files" "$toml_count" "$sh_count"
    echo "Patterns: Functions, Variables, Sections available for analysis"
}

span_get_active_multispan() {
    # Get currently active multispan (simplified)
    echo "${ACTIVE_SPAN_MULTISPAN:-None}"
}

span_render_active_multispan_preview() {
    local active="${ACTIVE_SPAN_MULTISPAN:-}"
    if [[ -n "$active" ]]; then
        echo "   ├─ cursor_1: config.toml:45-67 (database config)"
        echo "   ├─ cursor_2: deploy.sh:89-120 (connection setup)"
        echo "   └─ cursor_3: .env:12-15 (credentials)"
    else
        echo "   No active multispan - create one to start analysis"
    fi
}