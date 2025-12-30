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
  tsm start <command> [options]

OPTIONS
  --port N      Explicit port (else auto-detect or allocate 8000-8999)
  --env FILE    Environment file to source before starting
  --name NAME   Custom process name (else derived from directory)

EXAMPLES
  tsm start "node server.js" --port 3000
  tsm start "./run.sh" --env .env
  tsm start "python app.py" --name myapi'

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

TSM_HELP[list]='List managed processes.

USAGE
  tsm list [options]
  tsm ls [options]

OPTIONS
  -a, --all     Include stopped processes
  -p, --ports   Port-focused view (PORT, NAME, PID, PROTO)
  --json        JSON output for scripting

By default shows only running processes.'

TSM_HELP[info]='Show detailed information about a process.

USAGE
  tsm info <name|id>

ARGUMENTS
  name|id    Process name or numeric ID

Shows: name, ID, PID, status, port, command, CWD, env file,
uptime, CPU/memory usage, and log file locations.'

TSM_HELP[logs]='View process logs.

USAGE
  tsm logs <name|id> [-f|--follow]

ARGUMENTS
  name|id    Process name or numeric ID

OPTIONS
  -f, --follow   Stream logs in real-time (tail -f)

Logs are stored per-process:
  stdout: $TSM_DIR/runtime/processes/<name>/current.out
  stderr: $TSM_DIR/runtime/processes/<name>/current.err'

TSM_HELP[services]='List saved service definitions.

USAGE
  tsm services

Shows all .tsm service files in $TSM_SERVICES_DIR.
Enabled services are marked with [enabled].'

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

TSM_HELP[enable]='Enable a service for startup.

USAGE
  tsm enable <name>

ARGUMENTS
  name    Service name (from tsm services)

Creates a symlink in $TSM_SERVICES_DIR/enabled/.'

TSM_HELP[disable]='Disable a service from startup.

USAGE
  tsm disable <name>

ARGUMENTS
  name    Service name

Removes the symlink from $TSM_SERVICES_DIR/enabled/.'

TSM_HELP[startup]='Start all enabled services.

USAGE
  tsm startup

Starts each service in $TSM_SERVICES_DIR/enabled/.
Typically called at system boot or after tetra init.'

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

export -f tsm_show_help
