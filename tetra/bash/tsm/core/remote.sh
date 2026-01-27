#!/usr/bin/env bash
# TSM Remote - Execute TSM commands on remote hosts via SSH
#
# Usage:
#   tsm @dev ls -A                  # Use deploy target (@prefix)
#   tsm --remote=dev ls -A          # Use deploy target (--remote=)
#   tsm --remote dev ls -A          # Use deploy target (--remote)
#   tsm -H root@host ls -A          # Explicit host
#   tsm @dev logs arcade -f         # Stream logs from remote

# === CONFIGURATION ===

# Default SSH options for remote connections
TSM_REMOTE_SSH_OPTS="${TSM_REMOTE_SSH_OPTS:--o ConnectTimeout=10 -o BatchMode=yes}"

# === TARGET RESOLUTION ===

# Resolve @target to SSH connection string
# Looks in: $TETRA_DIR/orgs/*/tetra.toml for target definitions
# Format in toml: "@dev" = { auth_user = "root", work_user = "dev", host = "1.2.3.4" }
tsm_resolve_target() {
    local target="$1"  # e.g., "@dev"

    # Strip @ prefix
    local name="${target#@}"

    # Find current org's tetra.toml
    local tetra_toml=""
    if [[ -n "${TETRA_ORG:-}" && -f "$TETRA_DIR/orgs/$TETRA_ORG/tetra.toml" ]]; then
        tetra_toml="$TETRA_DIR/orgs/$TETRA_ORG/tetra.toml"
    else
        # Try to find any org with this target
        for toml in "$TETRA_DIR"/orgs/*/tetra.toml; do
            [[ -f "$toml" ]] || continue
            if grep -q "\"@$name\"" "$toml" 2>/dev/null; then
                tetra_toml="$toml"
                break
            fi
        done
    fi

    if [[ -z "$tetra_toml" ]]; then
        tsm_error "No target found: $target"
        return 1
    fi

    # Parse the target from toml
    # Format: "@dev" = { auth_user = "root", work_user = "dev", host = "1.2.3.4" }
    local target_line=$(grep "\"@$name\"" "$tetra_toml" | head -1)
    if [[ -z "$target_line" ]]; then
        tsm_error "Target not found in $tetra_toml: $target"
        return 1
    fi

    # Extract host and auth_user (macOS-compatible using grep + cut)
    local host=$(echo "$target_line" | grep -o 'host = "[^"]*"' | cut -d'"' -f2)
    local auth_user=$(echo "$target_line" | grep -o 'auth_user = "[^"]*"' | cut -d'"' -f2)

    if [[ -z "$host" ]]; then
        tsm_error "No host found for target: $target"
        return 1
    fi

    # Return user@host format
    if [[ -n "$auth_user" ]]; then
        echo "${auth_user}@${host}"
    else
        echo "$host"
    fi
}

# === REMOTE EXECUTION ===

# Execute TSM command on remote host
# Usage: tsm_remote "user@host" <tsm_args...>
tsm_remote() {
    local ssh_target="$1"
    shift

    if [[ -z "$ssh_target" ]]; then
        tsm_error "No remote target specified"
        return 1
    fi

    # Build the remote command
    # Source tetra.sh and run tsm with args
    local remote_cmd="source ~/tetra/tetra.sh && tsm $*"

    # Check for interactive commands that need PTY
    local needs_pty=false
    case "$1" in
        logs)
            # Check for -f flag
            for arg in "$@"; do
                [[ "$arg" == "-f" || "$arg" == "--follow" ]] && needs_pty=true
            done
            ;;
    esac

    # Execute remotely
    if [[ "$needs_pty" == true ]]; then
        # Allocate PTY for interactive commands
        ssh -t $TSM_REMOTE_SSH_OPTS "$ssh_target" "$remote_cmd"
    else
        ssh $TSM_REMOTE_SSH_OPTS "$ssh_target" "$remote_cmd"
    fi
}

# === CLI INTEGRATION ===

# Parse remote flags from tsm arguments
# Returns: TSM_REMOTE_TARGET (if set) and remaining args
# Usage: eval "$(tsm_parse_remote_args "$@")"
tsm_parse_remote_args() {
    local remote_target=""
    local args=()

    while [[ $# -gt 0 ]]; do
        case "$1" in
            @*)
                # @target syntax
                remote_target="$1"
                ;;
            -H|--host)
                # Explicit host
                shift
                remote_target="$1"
                ;;
            *)
                args+=("$1")
                ;;
        esac
        shift
    done

    echo "TSM_REMOTE_TARGET=\"$remote_target\""
    echo "TSM_REMOTE_ARGS=(${args[*]@Q})"
}

# Wrapper for tsm that handles remote targets
# If @target, --remote=target, or -H host is found, execute remotely
# Syntax:
#   tsm @dev ls           # @target prefix
#   tsm --remote=dev ls   # --remote= flag
#   tsm -H user@host ls   # explicit host
tsm_maybe_remote() {
    local first_arg="$1"

    # Check for @target syntax
    if [[ "$first_arg" == @* ]]; then
        local target="$first_arg"
        shift

        # Resolve target to SSH connection
        local ssh_target=$(tsm_resolve_target "$target")
        [[ -z "$ssh_target" ]] && return 1

        echo "Remote: $ssh_target" >&2
        tsm_remote "$ssh_target" "$@"
        return $?
    fi

    # Check for --remote=TARGET syntax (new)
    if [[ "$first_arg" == --remote=* ]]; then
        local target="${first_arg#--remote=}"
        shift

        # Resolve target to SSH connection (add @ prefix if not present)
        [[ "$target" != @* ]] && target="@$target"
        local ssh_target=$(tsm_resolve_target "$target")
        [[ -z "$ssh_target" ]] && return 1

        echo "Remote: $ssh_target" >&2
        tsm_remote "$ssh_target" "$@"
        return $?
    fi

    # Check for --remote TARGET syntax (with space)
    if [[ "$first_arg" == "--remote" ]]; then
        shift
        local target="$1"
        shift

        if [[ -z "$target" ]]; then
            tsm_error "Missing target for --remote flag"
            return 1
        fi

        # Resolve target to SSH connection (add @ prefix if not present)
        [[ "$target" != @* ]] && target="@$target"
        local ssh_target=$(tsm_resolve_target "$target")
        [[ -z "$ssh_target" ]] && return 1

        echo "Remote: $ssh_target" >&2
        tsm_remote "$ssh_target" "$@"
        return $?
    fi

    # Check for -H/--host flag
    if [[ "$first_arg" == "-H" || "$first_arg" == "--host" ]]; then
        shift
        local ssh_target="$1"
        shift

        if [[ -z "$ssh_target" ]]; then
            tsm_error "Missing host for -H flag"
            return 1
        fi

        echo "Remote: $ssh_target" >&2
        tsm_remote "$ssh_target" "$@"
        return $?
    fi

    # Not a remote command, return 2 to indicate local execution
    return 2
}

# === STATUS/INFO HELPERS ===

# Check if remote host is reachable
tsm_remote_ping() {
    local ssh_target="$1"
    ssh -o ConnectTimeout=5 -o BatchMode=yes "$ssh_target" "echo ok" &>/dev/null
}

# Get remote TSM summary
tsm_remote_status() {
    local ssh_target="$1"
    tsm_remote "$ssh_target" "ls -A"
}

# === EXPORTS ===

export TSM_REMOTE_SSH_OPTS
export -f tsm_resolve_target tsm_remote tsm_parse_remote_args tsm_maybe_remote
export -f tsm_remote_ping tsm_remote_status
