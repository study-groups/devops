#!/usr/bin/env bash
# boot_context.sh - Shell resolution + invocation mode detection
# Runs early in boot chain, after boot_core.sh
#
# Sets:
#   TETRA_SHELL        - Path to validated bash 5.2+ binary
#   TETRA_INVOKE_MODE  - interactive|ssh|agent|cron|script
#   TETRA_INVOKE_FLAGS - Space-separated compound states (e.g. "ssh interactive")

# =============================================================================
# A. TETRA_SHELL RESOLUTION
# =============================================================================
# Find and validate the bash 5.2+ binary. Priority:
#   1. User override (export TETRA_SHELL=... in start-tetra.sh)
#   2. $BASH (the running interpreter — should already be 5.2+ per bootloader gate)

if [[ -z "${TETRA_SHELL:-}" ]]; then
    TETRA_SHELL="$BASH"
fi

# Validate TETRA_SHELL points to bash 5.2+
if [[ -x "$TETRA_SHELL" ]]; then
    local_ver=$("$TETRA_SHELL" -c 'echo "${BASH_VERSINFO[0]}.${BASH_VERSINFO[1]}"' 2>/dev/null)
    local_major="${local_ver%%.*}"
    local_minor="${local_ver#*.}"
    if [[ "${local_major:-0}" -lt 5 ]] || [[ "${local_major:-0}" -eq 5 && "${local_minor:-0}" -lt 2 ]]; then
        echo "Warning: TETRA_SHELL ($TETRA_SHELL) is bash $local_ver, need 5.2+" >&2
        # Fall back to $BASH which passed the bootloader gate
        TETRA_SHELL="$BASH"
    fi
    unset local_ver local_major local_minor
else
    TETRA_SHELL="$BASH"
fi

export TETRA_SHELL

# Fix SHELL if it points to old bash (programs use $SHELL to spawn subshells)
if [[ -n "$TETRA_SHELL" ]]; then
    _shell_ver=$("$SHELL" -c 'echo "${BASH_VERSINFO[0]:-0}"' 2>/dev/null || echo "0")
    if [[ "$_shell_ver" -lt 5 ]]; then
        export SHELL="$TETRA_SHELL"
    fi
    unset _shell_ver
fi

# =============================================================================
# B. INVOCATION MODE DETECTION
# =============================================================================
# Detect how tetra was invoked and set TETRA_INVOKE_MODE + TETRA_INVOKE_FLAGS
#
# Modes (in priority order):
#   agent       - CI/CD or AI agent ($CLAUDE_CODE, $CI, $GITHUB_ACTIONS)
#   cron        - No TTY, parent is cron
#   ssh         - Remote SSH session ($SSH_CONNECTION or $SSH_CLIENT)
#   interactive - Interactive terminal with no SSH
#   script      - Fallback (non-interactive, non-cron, non-ssh)

_tetra_detect_invoke_mode() {
    local flags=""
    local mode="script"

    # Check interactive
    if [[ $- == *i* ]]; then
        flags+="interactive "
        mode="interactive"
    fi

    # Check SSH
    if [[ -n "${SSH_CONNECTION:-}" || -n "${SSH_CLIENT:-}" ]]; then
        flags+="ssh "
        mode="ssh"
    fi

    # Check agent (overrides ssh/interactive)
    if [[ -n "${CLAUDE_CODE:-}" || -n "${CI:-}" || -n "${GITHUB_ACTIONS:-}" || -n "${JENKINS_URL:-}" || -n "${BUILDKITE:-}" ]]; then
        flags+="agent "
        mode="agent"
    fi

    # Check cron (no TTY, not agent)
    if [[ "$mode" != "agent" ]] && ! tty -s 2>/dev/null; then
        local ppid_name
        ppid_name=$(ps -o comm= -p "$PPID" 2>/dev/null || true)
        if [[ "$ppid_name" == *cron* ]]; then
            flags+="cron "
            mode="cron"
        fi
    fi

    # Allow user override
    if [[ -n "${TETRA_INVOKE_MODE:-}" ]]; then
        mode="$TETRA_INVOKE_MODE"
    fi

    export TETRA_INVOKE_MODE="$mode"
    export TETRA_INVOKE_FLAGS="${flags% }"
}

_tetra_detect_invoke_mode
unset -f _tetra_detect_invoke_mode
