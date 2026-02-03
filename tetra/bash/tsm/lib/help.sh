#!/usr/bin/env bash
# TSM Per-Command Help with optional chroma integration

# Chroma integration disabled for now - use plain text
TSM_CHROMA_LOADED=false

# Simple formatted output (fallback when no chroma)
_tsm_heading() {
    local text="$1"
    if [[ "$TSM_COLORS_LOADED" == "true" ]]; then
        tds_color "info" "$text"
        echo
    else
        echo "$text"
    fi
}

_tsm_option() {
    local opt="$1" desc="$2"
    printf "  %-20s %s\n" "$opt" "$desc"
}

_tsm_example() {
    local cmd="$1"
    if [[ "$TSM_COLORS_LOADED" == "true" ]]; then
        printf "  %b\n" "$(tds_color 'muted' "$cmd")"
    else
        echo "  $cmd"
    fi
}

# Help text storage
declare -gA TSM_HELP

TSM_HELP[start]='Start a new managed process.

USAGE
  tsm start <service|./path.tsm|command> [options]

OPTIONS
  --port N      Explicit port (overrides env/service config)
  --env FILE    Environment file or name (local/dev/staging/prod)
  --name NAME   Custom process name (else derived from directory)
  --dryrun, -n  Show what would happen without starting

INPUTS
  service       Registered service name (from tsm ls available)
  ./path.tsm    Path to a .tsm service definition file
  command       Raw command to run (quote if contains spaces)

PORT RESOLUTION (3-step ladder)
  1. --port argument (wins if provided)
  2. PORT= from env file
  3. Auto-allocate from 8000-8999

EXAMPLES
  tsm start http                         # Start registered service
  tsm start ./myapp.tsm                  # Start from .tsm file
  tsm start ./myapp.tsm --env dev        # With org env override
  tsm start ./myapp.tsm --dryrun         # Preview without starting
  tsm start "node server.js" --port 3000 # Raw command mode'

TSM_HELP[stop]='Stop a running process gracefully.

USAGE
  tsm stop <name|id>

ARGUMENTS
  name|id    Process name or numeric ID (see tsm list)

The process receives SIGTERM and has 5 seconds to exit gracefully.
If still running after timeout, it will be forcefully killed.'

TSM_HELP[restart]='Restart a process (stop then start).

USAGE
  tsm restart <name|id>

ARGUMENTS
  name|id    Process name or numeric ID

Restarts the process using its original command and options.'

TSM_HELP[kill]='Forcefully kill a process immediately.

USAGE
  tsm kill <name|id>

ARGUMENTS
  name|id    Process name or numeric ID

Uses SIGKILL - the process has no chance to clean up.'

TSM_HELP[delete]='Remove a process and its metadata.

USAGE
  tsm delete <name|id>

ARGUMENTS
  name|id    Process name or numeric ID

Stops the process if running, then removes all metadata and logs.'

TSM_HELP[list]='List processes or service definitions.

USAGE
  tsm ls [available|enabled] [options]

MODES
  (default)     Running processes
  available     Service definitions catalog (services-available/)
  enabled       Auto-start services (services-enabled/)

OPTIONS
  -a, --all        Include stopped processes (running mode)
  -U, --all-users  Show all users (requires root)
  --org ORG        Filter by organization name
  -p, --ports      Port-focused view
  -g, --group      Group by stack
  --json           JSON output for scripting

EXAMPLES
  tsm ls                        # Running processes
  tsm ls -a                     # Include stopped
  tsm ls -U                     # All users (root only)
  tsm ls available              # Service definitions
  tsm ls available --org tetra  # Filter by org
  tsm ls enabled                # Auto-start services
  tsm ls enabled --json         # JSON output

LIFECYCLE
  .tsm file → tsm add → available → tsm enable → enabled → tsm start → running'

TSM_HELP[info]='Show detailed information about a running process.

USAGE
  tsm info <name|id>

ARGUMENTS
  name|id    Process name or numeric ID

Shows: name, ID, PID, status, port, command, CWD, env file,
uptime, CPU/memory usage, and log file locations.'

TSM_HELP[describe]='Describe a .tsm file or service definition.

USAGE
  tsm describe <service|./path.tsm> [--env FILE]

ARGUMENTS
  service      Registered service name (from tsm ls available)
  ./path.tsm   Path to a .tsm service definition file

OPTIONS
  --env FILE   Override environment file for port/config preview

Shows the complete service configuration including:
  - Source file location and metadata
  - Command and working directory
  - Port specification and resolution
  - Environment file resolution
  - Dependencies and health checks

Use this to understand how env influences startup BEFORE running.

EXAMPLES
  tsm describe http                    # Describe registered service
  tsm describe ./myapp.tsm             # Describe .tsm file
  tsm describe ./myapp.tsm --env prod  # Preview with prod env

RELATED
  tsm start ./myapp.tsm --dryrun       # Runtime preview (actual port alloc)'

TSM_HELP[logs]='View process logs with optional timestamps and formatting.

USAGE
  tsm logs <name|id> [options]
  tsm logs <subcommand> [args]

ARGUMENTS
  name|id    Process name or numeric ID

OPTIONS
  -f, --follow       Stream logs in real-time
  -n, --lines N      Show last N lines (default: 50)
  --since TIME       Filter by time: duration (5m, 1h) or timestamp
  -t, --timestamps   Prepend compact ISO timestamps (20260113T143245.123Z)
  --delta            Show delta time between lines (+SS.mmm)
  -e, --stderr-only  Show only stderr output
  -o, --stdout-only  Show only stdout output
  --json             Output as JSON for dashboard integration

SUBCOMMANDS (Log Management)
  rotate <name|all> [-f]   Rotate logs to timestamped archive
  archive <name|all>       Compress uncompressed archives (gzip)
  clean <name|all>         Remove archives older than retention (7d default)
  export <name|all> [-d]   Upload archives to S3/Spaces
  list [name]              List archived logs

EXAMPLES
  tsm logs myapp                    # Last 50 lines, both streams
  tsm logs myapp -n 100             # Last 100 lines
  tsm logs myapp -f                 # Follow mode (tail -f)
  tsm logs myapp -t                 # With timestamps
  tsm logs myapp --delta            # With delta timing (+0.000, +0.023, ...)
  tsm logs myapp --json             # JSON output for aggregation

  tsm logs rotate myapp             # Rotate if over threshold (10MB)
  tsm logs rotate all -f            # Force rotate all services
  tsm logs clean all                # Remove old archives
  tsm logs export myapp -d spaces   # Upload to DO Spaces

TIMESTAMP FORMAT
  Absolute: 20260113T143245.123Z (compact ISO 8601, UTC, milliseconds)
  Delta:    +SS.mmm (seconds since previous line, first line is +0.000)

CONFIGURATION (environment variables)
  TSM_LOG_ROTATION_SIZE_MB=10   Rotate when log exceeds this size
  TSM_LOG_RETENTION_DAYS=7      Keep archives for this many days
  TSM_LOG_COMPRESS=true         Compress archives with gzip
  TSM_LOG_S3_BUCKET             S3/Spaces bucket for export
  TSM_LOG_S3_ENDPOINT           Custom endpoint (for DO Spaces)

Logs are stored per-process:
  stdout: $TSM_DIR/runtime/processes/<name>/current.out
  stderr: $TSM_DIR/runtime/processes/<name>/current.err

Archives stored at: $TSM_DIR/runtime/logs/<name>/'

TSM_HELP[save]='Save a service definition for later use.

USAGE
  tsm save <name> <command> [options]

ARGUMENTS
  name       Service name (used for enable/disable/startup)
  command    Command to run (quote if contains spaces)

OPTIONS
  --port N      Port to use
  --env FILE    Environment file path

Creates a .tsm file in $TSM_SERVICES_DIR.'

TSM_HELP[enable]='Enable a service for auto-start.

USAGE
  tsm enable <name>

ARGUMENTS
  name    Service name (from tsm ls available)

Promotes a service from services-available/ to services-enabled/.
Enabled services start with "tsm startup".'

TSM_HELP[disable]='Disable a service from auto-start.

USAGE
  tsm disable <name>

ARGUMENTS
  name    Service name (from tsm ls enabled)

Demotes a service from services-enabled/ back to services-available/.
The service remains available but will not start with "tsm startup".'

TSM_HELP[startup]='Start all enabled services.

USAGE
  tsm startup

Starts each service listed in "tsm ls enabled".
Typically called at system boot or by systemd tetra.service.'

TSM_HELP[doctor]='Run diagnostics and health checks.

USAGE
  tsm doctor [subcommand] [args]

SUBCOMMANDS
  health          Check environment, dependencies, setsid
  ports [range]   Scan port range (e.g., 3000-5000)
  orphans         Find untracked processes
  clean           Remove stale process metadata

EXAMPLES
  tsm doctor                 # Full health check
  tsm doctor ports 3000-5000 # Scan port range
  tsm doctor orphans         # Find orphan processes
  tsm doctor clean           # Cleanup stale files'

TSM_HELP[caddy]='Manage Caddy reverse proxy integration.

USAGE
  tsm caddy <subcommand>

SUBCOMMANDS
  generate    Generate Caddyfile from running processes
  show        Display current Caddyfile
  start       Start Caddy server
  stop        Stop Caddy server
  reload      Reload Caddy configuration
  status      Show Caddy status

Caddy auto-generates reverse proxy entries:
  {name}.{domain} -> localhost:{port}'

TSM_HELP[cleanup]='Remove stopped process metadata.

USAGE
  tsm cleanup

Removes metadata directories for processes that are no longer running.
Does not affect running processes.'

TSM_HELP[setup]='Initialize TSM directories.

USAGE
  tsm setup

Creates:
  $TSM_DIR/runtime/processes/
  $TSM_DIR/runtime/logs/
  $TSM_DIR/services/

Also checks for setsid availability on macOS.'

# Display help for a command
tsm_show_help() {
    local cmd="$1"

    if [[ -n "${TSM_HELP[$cmd]}" ]]; then
        # Use chroma if available for markdown rendering
        if [[ "$TSM_CHROMA_LOADED" == "true" ]]; then
            echo "${TSM_HELP[$cmd]}" | chroma --stdin
        else
            # Plain output with basic formatting
            echo "${TSM_HELP[$cmd]}"
        fi
    else
        # Fall back to general help
        _tsm_help
    fi
}

