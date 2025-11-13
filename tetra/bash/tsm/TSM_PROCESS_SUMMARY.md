 TSM Process Lifecycle: Complete Analysis

  Overview

  TSM (Tetra Service Manager) is a PM2-style process manager built in Bash
  that provides sophisticated process lifecycle management for Python,
  Node.js, Bash, and generic command processes. It uses JSON metadata,
  automatic port allocation, and thread-safe ID management.

  ---
  1. How TSM Starts Processes

  Universal Start System

  Entry Point: /Users/mricos/src/devops/tetra/bash/tsm/core/start.sh:104-324

  TSM uses a universal start command (tsm_start_any_command()) that handles
  all process types through a unified flow:

  # From core/start.sh:104
  tsm_start_any_command() {
      local command="$1"
      local env_file="$2"
      local explicit_port="$3"
      local explicit_name="$4"
      local explicit_prehook="$5"

  Start Flow (11 Steps)

  Step 1: Parse Environment File (core/environment.sh:26-39)
  eval "$(tsm_parse_env_file "$env_file")"
  # Extracts ENV_PORT and ENV_NAME in a single subshell

  Step 2: Detect Process Type (core/runtime.sh:6-47)
  process_type=$(tsm_detect_type "$command")
  # Returns: python, node, bash, lua, go, or command

  Step 3: Resolve Interpreter (core/runtime.sh:49-124)
  - Python: Uses $PYENV_ROOT/shims/python if available
  - Node: Uses nvm-managed node from $TETRA_DIR/nvm
  - Bash: Platform-specific (/opt/homebrew/bin/bash on macOS)

  Step 4: Rewrite Command (core/runtime.sh:159-195)
  final_command=$(tsm_rewrite_command_with_interpreter "$command"
  "$process_type" "$interpreter")
  # Example: "python server.py" → "/opt/homebrew/bin/python3 server.py"

  Step 5: Port Resolution (core/start.sh:6-43)

  From README.md:284-292, TSM uses a 6-step priority ladder:
  1. Explicit --port flag (highest priority)
  2. PORT= from environment file
  3. Script file inspection
  4. Command scanning (:8000, --port 8000)
  5. Pattern matching from patterns.txt
  6. Default/none

  Step 6: Name Generation (core/start.sh:46-101)

  From README.md:213-235:
  "TSM automatically generates descriptive names based on your directory and
   command"

  Priority order:
  1. --name flag → api-8000
  2. NAME= in env file → myapp-8000
  3. package.json "name" field
  4. Directory + script → my-api-server-8000
  5. Directory + module → demo-http-8000

  Step 7: Check If Already Running (core/metadata.sh:143-164)
  tsm_process_exists "$name" && return 1

  Step 8: Setup Process Directory
  mkdir -p "$TSM_PROCESSES_DIR/$name"

  Step 9: Build Pre-Hook (core/hooks.sh)
  prehook_cmd=$(tsm_build_prehook "$explicit_prehook" "$process_type")
  # Activates pyenv for Python, nvm for Node

  Step 10: Start with setsid (core/start.sh:196-210)
  setsid bash -c "
      $prehook_cmd
      source '$env_file'
      $final_command &
      echo \$! > '${pid_file}'
  " 2>>'${log_wrapper}' &

  Step 11: Create PM2-Style Metadata (core/metadata.sh:19-76)
  tsm_id=$(tsm_create_metadata "$name" "$pid" "$final_command" "$port" ...)

  Port Conflict Detection

  From core/start.sh:243-263, if the process dies immediately:
  if ! tsm_is_pid_alive "$pid"; then
      local existing_pid=$(lsof -ti :$port)
      echo "🔴 Port $port is already in use!"
      echo "   Blocking process: PID $existing_pid"

  ---
  2. How TSM Tracks Process Lifecycle

  PM2-Style Metadata System

  Location: $TSM_PROCESSES_DIR/<process-name>/meta.json

  From TSM_SPECIFICATION.md:255-277:
  "TSM uses PM2-style metadata stored in JSON format"

  Example metadata structure:
  {
    "tsm_id": 2,
    "name": "spa-http-8001",
    "pid": 68884,
    "command": "/opt/homebrew/bin/python3 -m http.server 8001",
    "port": 8001,
    "cwd": "/Users/mricos/src/mricos/demos/cell/spa",
    "interpreter": "/opt/homebrew/bin/python3",
    "process_type": "python",
    "service_type": "port",
    "env_file": "",
    "prehook": "",
    "status": "online",
    "start_time": 1762019852,
    "restarts": 0,
    "unstable_restarts": 0
  }

  Metadata Fields (TSM_SPECIFICATION.md:279-292)

  - tsm_id: Unique TSM process ID (thread-safe allocation)
  - name: Process name (auto-generated: {dirname}-{module}-{port})
  - pid: System process ID
  - command: Full command with resolved interpreter
  - port: Port number or "none"
  - status: "online", "stopped", or "crashed"
  - restarts: Restart counter
  - start_time: Unix timestamp

  Thread-Safe ID Allocation

  Critical System: core/utils.sh:138-197 - tetra_tsm_get_next_id()

  # 1. Acquire exclusive lock (5 second timeout)
  exec 200>"$lock_file"
  flock -x -w 5 200

  # 2. Scan all meta.json files for used IDs
  # 3. Check reserved ID placeholders (.reserved-N/)
  # 4. Sort and find lowest unused ID (handles gaps)
  # 5. Reserve this ID with placeholder directory
  mkdir -p "$TSM_PROCESSES_DIR/.reserved-$next_id"

  # 6. Release lock
  flock -u 200

  Key Features:
  - Handles concurrent starts without race conditions
  - Reuses IDs from deleted processes (fills gaps)
  - Placeholder directories prevent ID reuse

  Runtime Directory Structure

  From TSM_SPECIFICATION.md and README.md:519-530:

  $TETRA_DIR/tsm/runtime/
  ├── processes/
  │   └── devpages-4000/
  │       ├── meta.json           # Process metadata
  │       ├── devpages-4000.pid   # PID file
  │       ├── current.out         # stdout logs
  │       ├── current.err         # stderr logs
  │       └── wrapper.err         # Startup errors
  ├── logs/                        # Legacy (deprecated)
  ├── pids/                        # PID files
  └── ports/                       # Port registry

  ---
  3. Types of TSM Processes

  Service Type Classification

  From README.md:129-139, TSM classifies services into three types:

  1. port - Network services (HTTP servers, APIs)
  2. socket - Unix domain socket services (workers, daemons)
  3. pid - Simple process tracking (no network)

  Process Types Supported

  1. Python Applications (README.md:166-176)

  # HTTP server
  tsm start python -m http.server 8000

  # Python app with auto-port allocation
  tsm start python run.py

  # With environment
  tsm start --env prod python app.py

  Python-specific handling:
  - Activates pyenv if available
  - Sets PYTHONUNBUFFERED=1
  - Resolves to $PYENV_ROOT/shims/python

  2. Node.js Applications (README.md:178-190)

  # Node script
  tsm start node server.js

  # With explicit port
  tsm start --port 3000 node app.js

  # npm/yarn
  tsm start npm start

  Node-specific handling:
  - Sources $TETRA_DIR/nvm/nvm.sh if available
  - Extracts name from package.json

  3. Bash Scripts (README.md:192-200)

  # Executable script
  tsm start ./my-script.sh

  # With environment
  tsm start --env dev ./server.sh

  4. Generic Commands (README.md:202-209)

  tsm start "ruby server.rb -p 4000"
  tsm start "go run main.go"
  tsm start "php -S localhost:8080"

  ---
  4. Process Lifecycle Operations

  Stop Flow

  Implementation: process/lifecycle.sh:182-253 - tetra_tsm_stop_single()

  # 1. Get PID from metadata
  local pid=$(jq -r '.pid' "$TSM_PROCESSES_DIR/$name/meta.json")

  # 2. Get process group ID
  local pgid=$(ps -p "$pid" -o pgid=)

  # 3. Graceful shutdown (SIGTERM to entire process group)
  kill "-$pgid"

  # 4. Wait up to 10 seconds
  for i in {1..10}; do
      _tsm_is_process_running "$pid" || break
      sleep 1
  done

  # 5. Force kill if still running (SIGKILL)
  kill -9 "-$pgid"

  # 6. Update metadata status
  jq '.status = "stopped"' "$meta_file" > "$temp_file"

  Restart Flow

  Implementation: process/lifecycle.sh:327-491 - tetra_tsm_restart_single()

  # 1. Read existing metadata
  local script=$(jq -r '.command' "$meta_file")
  local port=$(jq -r '.port' "$meta_file")

  # 2. Stop if running
  tetra_tsm_stop_single "$name" "true"

  # 3. Restart with same configuration
  _tsm_restart_unified "$name" "$script" "$port" "$type"

  # 4. Update metadata with new PID and increment counter
  jq '.pid = ($pid | tonumber) | .restarts += 1'

  Delete/Cleanup

  Implementation: process/lifecycle.sh:274-311 - tetra_tsm_delete_single()

  # 1. Stop process if running
  tetra_tsm_stop_single "$name" "true"

  # 2. Remove entire process directory
  rm -rf "$TSM_PROCESSES_DIR/$name"

  # 3. Clean up reserved ID placeholder
  rm -rf "$TSM_PROCESSES_DIR/.reserved-$tsm_id"

  ---
  5. Environment File Handling

  Environment File Discovery

  From README.md:284-292, TSM automatically looks for:
  1. env/local.env
  2. env/dev.env
  3. env/production.env
  4. .env

  Environment File Format

  From README.md:263-270:
  # env/dev.env
  export PORT=4000
  export NODE_ENV=development
  export DB_HOST=localhost
  export API_KEY=your-key-here

  Implementation

  Parsing: core/environment.sh:26-39 - tsm_parse_env_file()

  # Parse env file once and extract PORT and NAME together
  tsm_parse_env_file() {
      (
          source "$env_file" 2>/dev/null
          echo "ENV_PORT=${PORT:-${TETRA_PORT:-}}"
          echo "ENV_NAME=${NAME:-${TETRA_NAME:-}}"
      )
  }

  # Usage:
  eval "$(tsm_parse_env_file "$env_file")"

  Sourcing during startup: core/start.sh:196-201
  setsid bash -c "
      $prehook_cmd              # Activate pyenv/nvm
      source '$env_file'        # Source user env file
      $final_command &          # Run actual command
  "

  ---
  6. Strong Globals and Configuration

  From README.md:519-530:
  "TSM uses strong globals following CLAUDE.md conventions"

  Global Variables (core/config.sh:1-26):
  TETRA_SRC="/Users/user/src/devops/tetra"  # Source code
  TETRA_DIR="/Users/user/tetra"              # Runtime data

  # TSM-specific
  TSM_SRC="$TETRA_SRC/bash/tsm"
  TSM_DIR="$TETRA_DIR/tsm"

  # Runtime directories
  TSM_PROCESSES_DIR="$TETRA_DIR/tsm/runtime/processes"
  TSM_LOGS_DIR="$TETRA_DIR/tsm/runtime/logs"
  TSM_PIDS_DIR="$TETRA_DIR/tsm/runtime/pids"
  TSM_PORTS_DIR="$TETRA_DIR/tsm/runtime/ports"

  ---
  7. Code Organization

  Module Structure (53 shell scripts)

  From TSM_SPECIFICATION.md:322-383, TSM loads in 7 phases:

  1. Phase 1: Core Foundation - config.sh, utils.sh, validation.sh
  2. Phase 2: System Modules - ports.sh, formatting.sh, doctor.sh
  3. Phase 3: Service Modules - definitions.sh, registry.sh
  4. Phase 4: Process Modules - lifecycle.sh, management.sh, list.sh
  5. Phase 5: Interface Modules - REPL
  6. Phase 6: Integration Modules - nginx, systemd, TView
  7. Phase 7: Initialize Global State - _tsm_init_global_state()

  Function Naming Conventions (TSM_SPECIFICATION.md:123-172)

  Three-tier system:

  1. tetra_tsm_* - Public API (CLI commands)
    - Examples: tetra_tsm_start(), tetra_tsm_stop(), tetra_tsm_list()
  2. tsm_* - Module functions (internal helpers)
    - Examples: tsm_is_pid_alive(), tsm_create_metadata(),
  tsm_discover_port()
  3. _tsm_* - Private functions (implementation details)
    - Examples: _tsm_start_process(), _tsm_json_escape(),
  _tsm_init_global_state()

  ---
  Summary

  TSM Process Lifecycle Summary:

  1. Starts via universal command that detects type, resolves interpreter,
  discovers port, generates name
  2. Tracks using PM2-style JSON metadata with thread-safe ID allocation
  3. Manages Python, Node, Bash, and generic commands with type-specific
  pre-hooks
  4. Monitors via PID files, metadata status, and log files
  (stdout/stderr/wrapper)
  5. Operates on port-based, socket-based, or PID-based services
  6. Handles environment files with automatic discovery and sourcing
  7. Diagnoses failures with port conflict detection and startup error
  collection

  Key Implementation Files:
  - core/start.sh:104-324 - Universal start system
  - core/metadata.sh:19-76 - Metadata creation/management
  - process/lifecycle.sh:182-311 - Stop/restart/delete operations
  - core/utils.sh:138-197 - Thread-safe ID allocation
  - core/environment.sh:26-39 - Environment file parsing

