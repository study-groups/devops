#!/usr/bin/env bash
# Safe wrapper to source tetra.sh with error handling and debugging
# Can be sourced directly in interactive shell: source ~/tetra/safe_source_tetra.sh
# Or run with debugging: bash ~/tetra/safe_source_tetra.sh --debug

# Check if we're being sourced or executed
(return 0 2>/dev/null) && SOURCED=1 || SOURCED=0

# Parse arguments
DEBUG_MODE=0
TRACE_MODE=0
SAVE_LOG=0
LOG_FILE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --debug)
            DEBUG_MODE=1
            shift
            ;;
        --trace)
            TRACE_MODE=1
            DEBUG_MODE=1
            shift
            ;;
        --log)
            SAVE_LOG=1
            LOG_FILE="/tmp/tetra_source_$(date +%Y%m%d_%H%M%S).log"
            shift
            ;;
        --log-file)
            SAVE_LOG=1
            LOG_FILE="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: source $0 [--debug] [--trace] [--log] [--log-file PATH]"
            return 1 2>/dev/null || exit 1
            ;;
    esac
done

# Setup logging if requested
if [[ $SAVE_LOG -eq 1 ]]; then
    [[ -z "$LOG_FILE" ]] && LOG_FILE="/tmp/tetra_source_$(date +%Y%m%d_%H%M%S).log"
    echo "=== Tetra Source Debug Log ===" > "$LOG_FILE"
    echo "Started: $(date)" >> "$LOG_FILE"
    echo "Shell: $SHELL ($BASH_VERSION)" >> "$LOG_FILE"
    echo "" >> "$LOG_FILE"
fi

# Enable debugging if requested
if [[ $TRACE_MODE -eq 1 ]]; then
    echo "Enabling trace mode (set -x)..."
    [[ $SAVE_LOG -eq 1 ]] && echo "--- Trace Output ---" >> "$LOG_FILE"
    if [[ $SAVE_LOG -eq 1 ]]; then
        exec 3>&2 2>> "$LOG_FILE"
        set -x
    else
        set -x
    fi
fi

# Function to safely source with error handling
_safe_source() {
    local source_file="$1"
    local error_log="/tmp/tetra_error_$$.log"

    if [[ ! -f "$source_file" ]]; then
        echo "ERROR: File not found: $source_file"
        return 1
    fi

    if [[ $DEBUG_MODE -eq 1 ]]; then
        echo "Sourcing: $source_file"
        echo "TETRA_DIR=${TETRA_DIR:-unset}"
        echo "TETRA_SRC=${TETRA_SRC:-unset}"
    fi

    # Source with error capture
    if source "$source_file" 2>"$error_log"; then
        [[ $DEBUG_MODE -eq 1 ]] && echo "✓ Successfully sourced $source_file"
        [[ -f "$error_log" ]] && rm -f "$error_log"
        return 0
    else
        local exit_code=$?
        echo "✗ ERROR: Failed to source $source_file (exit code: $exit_code)"
        if [[ -s "$error_log" ]]; then
            echo "Error output:"
            cat "$error_log"
        fi
        [[ -f "$error_log" ]] && rm -f "$error_log"
        return $exit_code
    fi
}

# Main sourcing logic
[[ $DEBUG_MODE -eq 1 ]] && echo "=== Starting Tetra Source ==="

# Check for required environment
if [[ ! -d "$HOME/tetra" ]]; then
    echo "ERROR: ~/tetra directory not found"
    return 1 2>/dev/null || exit 1
fi

if [[ ! -f "$HOME/tetra/tetra.sh" ]]; then
    echo "ERROR: ~/tetra/tetra.sh not found"
    return 1 2>/dev/null || exit 1
fi

# Source tetra.sh
if _safe_source "$HOME/tetra/tetra.sh"; then
    [[ $DEBUG_MODE -eq 1 ]] && echo "=== Tetra Loaded Successfully ==="

    # Show loaded state
    if [[ $DEBUG_MODE -eq 1 ]]; then
        echo ""
        echo "Environment:"
        echo "  TETRA_DIR: ${TETRA_DIR}"
        echo "  TETRA_SRC: ${TETRA_SRC}"
        echo "  TETRA_BOOTLOADER_LOADED: ${TETRA_BOOTLOADER_LOADED}"

        if declare -F tetra_reload >/dev/null 2>&1; then
            echo "  tetra_reload: available"
        fi
    fi

    if [[ $SAVE_LOG -eq 1 ]]; then
        echo "" >> "$LOG_FILE"
        echo "=== Success ===" >> "$LOG_FILE"
        echo "Completed: $(date)" >> "$LOG_FILE"
        echo "Log saved to: $LOG_FILE"
    fi
else
    echo "=== Tetra Load Failed ==="
    if [[ $SAVE_LOG -eq 1 ]]; then
        echo "" >> "$LOG_FILE"
        echo "=== Failed ===" >> "$LOG_FILE"
        echo "Completed: $(date)" >> "$LOG_FILE"
        echo "Log saved to: $LOG_FILE"
    fi
    return 1 2>/dev/null || exit 1
fi

# Cleanup trace mode
if [[ $TRACE_MODE -eq 1 ]]; then
    set +x
    [[ $SAVE_LOG -eq 1 ]] && exec 2>&3 3>&-
fi

# If executed (not sourced), show usage
if [[ $SOURCED -eq 0 ]]; then
    echo ""
    echo "This script is meant to be sourced, not executed."
    echo "Usage:"
    echo "  source ~/tetra/safe_source_tetra.sh              # Normal sourcing"
    echo "  source ~/tetra/safe_source_tetra.sh --debug      # With debug output"
    echo "  source ~/tetra/safe_source_tetra.sh --trace      # With full trace"
    echo "  source ~/tetra/safe_source_tetra.sh --log        # Save log to /tmp"
    echo "  bash ~/tetra/safe_source_tetra.sh --trace --log  # Test in subshell with log"
fi
