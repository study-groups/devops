#!/usr/bin/env bash

# TSM Resource Manager - Handles process limits and resource management
# Specifically addresses macOS EMFILE issues with pgrep and child processes

# macOS has lower default limits - set conservative limits
TSM_MAX_CONCURRENT_PROCESSES=${TSM_MAX_CONCURRENT_PROCESSES:-5}
TSM_MAX_CHILD_PROCESSES=${TSM_MAX_CHILD_PROCESSES:-10}
TSM_PROCESS_TIMEOUT=${TSM_PROCESS_TIMEOUT:-30}

# Process tracking
declare -gA TSM_ACTIVE_PROCESSES
TSM_PROCESS_COUNT=0

# === RESOURCE MONITORING ===

tsm_check_system_limits() {
    local check_type="${1:-basic}"

    case "$check_type" in
        "detailed")
            echo "🔍 System Resource Check:"
            echo "========================"

            # Check open files limit
            local open_files_limit=$(ulimit -n)
            echo "Open files limit: $open_files_limit"

            # Check current open files (macOS specific)
            if [[ "$OSTYPE" == "darwin"* ]]; then
                local current_fds=$(lsof -p $$ 2>/dev/null | wc -l || echo "unknown")
                echo "Current open files: $current_fds"

                # Check process limit
                local proc_limit=$(ulimit -u)
                echo "Process limit: $proc_limit"

                # Count current processes
                local current_procs=$(pgrep -U $(id -u) | wc -l || echo "unknown")
                echo "Current processes: $current_procs"
            fi
            ;;
        *)
            # Basic check - just ensure we're not hitting limits
            local open_files_limit=$(ulimit -n)
            if [[ $open_files_limit -lt 256 ]]; then
                echo "⚠️  Warning: Low open files limit ($open_files_limit). Consider: ulimit -n 1024" >&2
            fi
            ;;
    esac
}

# === PROCESS MANAGEMENT ===

tsm_start_managed_process() {
    local command="$1"
    local timeout="${2:-$TSM_PROCESS_TIMEOUT}"
    local process_id="tsm_$$_$(date +%s)_$RANDOM"

    # Check if we're at the limit
    if [[ $TSM_PROCESS_COUNT -ge $TSM_MAX_CONCURRENT_PROCESSES ]]; then
        tsm_cleanup_finished_processes

        # Still at limit? Wait for a slot
        if [[ $TSM_PROCESS_COUNT -ge $TSM_MAX_CONCURRENT_PROCESSES ]]; then
            echo "⏳ Waiting for process slot..." >&2
            tsm_wait_for_process_slot 5
        fi
    fi

    # Start the process with timeout and resource limits
    (
        # Set resource limits for child process
        ulimit -n 64  # Limit open files for child
        ulimit -u 20  # Limit child processes

        # Execute with timeout
        timeout "$timeout" bash -c "$command" 2>/dev/null
    ) &

    local pid=$!
    TSM_ACTIVE_PROCESSES[$process_id]=$pid
    TSM_PROCESS_COUNT=$((TSM_PROCESS_COUNT + 1))

    echo "$process_id"
}

tsm_wait_for_process() {
    local process_id="$1"
    local timeout="${2:-30}"

    if [[ -n "${TSM_ACTIVE_PROCESSES[$process_id]}" ]]; then
        local pid=${TSM_ACTIVE_PROCESSES[$process_id]}

        # Wait with timeout
        local count=0
        while [[ $count -lt $timeout ]] && tsm_is_pid_alive "$pid"; do
            sleep 1
            count=$((count + 1))
        done

        # Cleanup
        unset TSM_ACTIVE_PROCESSES[$process_id]
        TSM_PROCESS_COUNT=$((TSM_PROCESS_COUNT - 1))

        # Force kill if still running
        if tsm_is_pid_alive "$pid"; then
            kill -TERM "$pid" 2>/dev/null || true
            sleep 1
            kill -KILL "$pid" 2>/dev/null || true
        fi
    fi
}

tsm_cleanup_finished_processes() {
    local cleaned=0

    for process_id in "${!TSM_ACTIVE_PROCESSES[@]}"; do
        local pid=${TSM_ACTIVE_PROCESSES[$process_id]}

        if ! tsm_is_pid_alive "$pid"; then
            unset TSM_ACTIVE_PROCESSES[$process_id]
            TSM_PROCESS_COUNT=$((TSM_PROCESS_COUNT - 1))
            cleaned=$((cleaned + 1))
        fi
    done

    if [[ $cleaned -gt 0 ]]; then
        echo "🧹 Cleaned up $cleaned finished processes" >&2
    fi
}

tsm_wait_for_process_slot() {
    local max_wait="${1:-10}"
    local count=0

    while [[ $TSM_PROCESS_COUNT -ge $TSM_MAX_CONCURRENT_PROCESSES ]] && [[ $count -lt $max_wait ]]; do
        tsm_cleanup_finished_processes
        sleep 1
        count=$((count + 1))
    done
}

tsm_cleanup_all_processes() {
    echo "🧹 Cleaning up all managed processes..." >&2

    for process_id in "${!TSM_ACTIVE_PROCESSES[@]}"; do
        local pid=${TSM_ACTIVE_PROCESSES[$process_id]}

        # Graceful termination first
        if tsm_is_pid_alive "$pid"; then
            kill -TERM "$pid" 2>/dev/null || true
        fi
    done

    # Wait a moment for graceful shutdown
    sleep 2

    # Force kill any remaining
    for process_id in "${!TSM_ACTIVE_PROCESSES[@]}"; do
        local pid=${TSM_ACTIVE_PROCESSES[$process_id]}

        if tsm_is_pid_alive "$pid"; then
            kill -KILL "$pid" 2>/dev/null || true
        fi
    done

    # Reset counters
    TSM_ACTIVE_PROCESSES=()
    TSM_PROCESS_COUNT=0

    echo "✅ Process cleanup complete" >&2
}

# === SAFE COMMAND EXECUTION ===

tsm_safe_pgrep() {
    local pattern="$1"
    local max_results="${2:-50}"

    # Use timeout and limit results to prevent resource exhaustion
    timeout 5 pgrep "$pattern" 2>/dev/null | head -n "$max_results" || true
}

tsm_safe_exec() {
    local command="$1"
    local description="${2:-command}"
    local timeout="${3:-30}"

    # Use managed process execution
    local process_id
    process_id=$(tsm_start_managed_process "$command" "$timeout")

    # Wait for completion
    tsm_wait_for_process "$process_id" "$timeout"
}

# === MACOS-SPECIFIC OPTIMIZATIONS ===

tsm_optimize_for_macos() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # Reduce default limits for macOS
        TSM_MAX_CONCURRENT_PROCESSES=3
        TSM_MAX_CHILD_PROCESSES=5
        TSM_PROCESS_TIMEOUT=20

        # Set conservative ulimits
        ulimit -n 512 2>/dev/null || true
        ulimit -u 100 2>/dev/null || true

        echo "🍎 Applied macOS optimizations" >&2
    fi
}

# === LOG PROCESSING WITH RESOURCE LIMITS ===

tsm_safe_log_processing() {
    local log_file="$1"
    local pattern="${2:-TETRA:}"
    local max_lines="${3:-1000}"
    local timeout="${4:-15}"

    if [[ ! -f "$log_file" ]]; then
        echo "Log file not found: $log_file" >&2
        return 1
    fi

    # Process logs with resource limits
    timeout "$timeout" tail -n "$max_lines" "$log_file" | \
        timeout "$timeout" grep "$pattern" 2>/dev/null | \
        head -n "$max_lines" || true
}

# === BATCH PROCESSING ===

tsm_batch_process() {
    local -n commands=$1
    local batch_size="${2:-3}"
    local timeout="${3:-30}"

    local batch_count=0
    local process_ids=()

    for command in "${commands[@]}"; do
        # Start process
        local process_id
        process_id=$(tsm_start_managed_process "$command" "$timeout")
        process_ids+=("$process_id")
        batch_count=$((batch_count + 1))

        # Wait for batch to complete
        if [[ $batch_count -ge $batch_size ]]; then
            for pid in "${process_ids[@]}"; do
                tsm_wait_for_process "$pid" "$timeout"
            done
            process_ids=()
            batch_count=0
        fi
    done

    # Wait for remaining processes
    for pid in "${process_ids[@]}"; do
        tsm_wait_for_process "$pid" "$timeout"
    done
}

# === INITIALIZATION ===

tsm_init_resource_manager() {
    # Apply macOS optimizations if needed
    tsm_optimize_for_macos

    # Basic system check
    tsm_check_system_limits basic

    # Set up cleanup trap
    trap 'tsm_cleanup_all_processes' EXIT INT TERM

    echo "🚀 TSM Resource Manager initialized" >&2
}

# === DEFERRED INITIALIZATION ===
# DO NOT auto-initialize when sourced - use deferred initialization
# Call tsm_init_resource_manager explicitly after all components loaded

# Component lifecycle interface
_tsm_component_resource_manager_info() {
    echo "name:resource_manager"
    echo "type:system"
    echo "dependencies:config"
    echo "optional_dependencies:"
    echo "description:Process limits and resource management for macOS EMFILE issues"
    echo "implementations:bash"
}

_tsm_component_resource_manager_init() {
    # Deferred initialization - called explicitly by lifecycle manager
    tsm_init_resource_manager
}

_tsm_component_resource_manager_start() {
    # Start any background monitoring if needed
    echo "Resource manager monitoring started"
}

_tsm_component_resource_manager_stop() {
    # Cleanup managed processes
    tsm_cleanup_all_processes
}

# Main function for direct execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    case "${1:-help}" in
        "check")
            tsm_check_system_limits detailed
            ;;
        "test")
            echo "Testing resource manager..."

            # Start some test processes
            for i in {1..5}; do
                echo "Starting test process $i"
                tsm_start_managed_process "sleep 3"
            done

            echo "Waiting for processes to complete..."
            sleep 5
            tsm_cleanup_finished_processes

            echo "Test complete"
            ;;
        *)
            echo "TSM Resource Manager"
            echo "Usage: $0 [check|test]"
            echo ""
            echo "Functions available when sourced:"
            echo "  tsm_start_managed_process <command> [timeout]"
            echo "  tsm_safe_exec <command> [description] [timeout]"
            echo "  tsm_safe_pgrep <pattern> [max_results]"
            echo "  tsm_safe_log_processing <file> [pattern] [max_lines] [timeout]"
            echo "  tsm_batch_process <commands_array> [batch_size] [timeout]"
            ;;
    esac
fi