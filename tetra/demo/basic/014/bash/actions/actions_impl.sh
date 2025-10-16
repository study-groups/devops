#!/usr/bin/env bash

# Action Implementations - Actual execution logic

# Get current execution context
get_execution_context() {
    local env="${ENVIRONMENTS[$ENV_INDEX]}"
    echo "@${env,,}"
}

execute_action_impl() {
    local action="$1"
    local verb="${action%%:*}"
    local noun="${action##*:}"
    local context=$(get_execution_context)

    case "$action" in
        help:signatures)
            cat <<'EOF'
Format:  verb:noun :: (inputs) → output [where effects]

Components:
  verb:noun     Action identifier (colorized by distance)
  ::            Endpoint operator (TES binding)
  (inputs)      Required input data/files
  →             Flow operator (data transformation)
  output        Primary result destination (@tui[content])
  [where ...]   Side effects (files written, services started)

Example:
  fetch:config :: () → @tui[content] [where @local[~/Downloads/config.toml]]

This means:
  • Action: fetch×config
  • Needs: no inputs
  • Returns: status to TUI content buffer
  • Effect: writes file to ~/Downloads/config.toml

Press 'i' on any action to see its full signature details.
EOF
            ;;

        help:contexts)
            cat <<'EOF'
Contexts define WHERE actions execute FROM:

HELP        Meta-environment for learning the system
            • No real operations, explanatory only
            • All modes show help actions

Local       Your local machine
            • Full access, no SSH required
            • Safe testing ground
            • All actions execute locally

Dev         Development server
            • Full read/write access
            • File transfers enabled
            • Remote command execution

Staging     Pre-production environment
            • Read-heavy operations
            • Controlled writes (safety checks)
            • Limited remote execution

Production  Live production systems
            • Read-only by default
            • Emergency writes only (requires confirmation)
            • Restricted command execution

Key Concept: exec_at vs source_at vs target_at
  • exec_at: Where the command runs (always @local)
  • source_at: Where data comes from
  • target_at: Where data goes to
EOF
            ;;

        help:modes)
            cat <<'EOF'
Modes define WHAT KIND of operations you want to perform:

Inspect     Read-only operations
            • View configurations
            • Check status
            • Read logs
            • No side effects

Transfer    File operations
            • Fetch files from remote
            • Push files to remote
            • Sync directories
            • Creates/modifies files

Execute     Command execution
            • Run remote commands
            • Restart services
            • Process management
            • System-level changes

Context + Mode determines available actions:
  Local + Inspect  → view local configs, check local status
  Dev + Transfer   → fetch/push/sync files with dev server
  Staging + Execute → limited remote command execution
EOF
            ;;

        help:operations)
            cat <<'EOF'
TES (Tetra Endpoint Specification) defines HOW data flows:

read        Retrieve data from remote endpoint
            • ssh remote 'cat file'
            • scp remote:file local:file
            • Requires: source_at != @local

write       Send data to remote endpoint
            • scp local:file remote:file
            • rsync local/ remote/
            • Requires: target_at != @local
            • May need confirmation (staging/prod)

execute     Run command on remote endpoint
            • ssh remote 'command args'
            • Process management
            • System operations
            • Highest privilege requirement

local       No remote operations
            • Pure local execution
            • No SSH/network required
            • Default for most actions

Operation + Context determines safety requirements:
  write + Production → requires confirmation + audit
  execute + Staging  → requires approval
  read + any         → generally safe
EOF
            ;;

        show:demo)
            cat <<EOF
Current Context: $context

This demo shows:
• Clear I/O signatures: (inputs) → output [where effects]
• Execution contexts: Local, Dev, Staging, Production
• File transfer operations across endpoints
• TES operation types: read, write, execute

Action anatomy:
  • exec_at:    Where the action runs (@local always)
  • source_at:  Where data comes from
  • target_at:  Where data goes to
  • inputs:     What files/data are needed
  • output:     Primary result destination
  • effects:    Side effects (files written, processes started)

Press 'i' on any action to see its full signature.
EOF
            ;;

        show:help)
            cat <<'EOF'
Navigation:
  e/E - Cycle execution context
  d/D - Cycle mode (Inspect/Transfer/Execute)
  f/F - Cycle action
  i/I - Toggle action detail view
  Enter - Execute current action

Views:
  s - Show all action signatures
  l - Show execution log

Controls:
  c - Clear content
  q - Quit

Execution Contexts:
  Local      - Your machine, local operations only
  Dev        - Development server, full access
  Staging    - Staging environment, read-heavy
  Production - Production, read-only + controlled writes
EOF
            ;;

        show:signatures)
            list_action_signatures
            ;;

        view:env)
            cat <<EOF
Current Context: $context
  • All actions execute locally (@local)
  • Remote operations target: $context
  • File transfers: @local ↔ $context

Context Meanings:
  @local      - This machine, your working environment
  @dev        - Development server (full access)
  @staging    - Staging environment (read + controlled write)
  @production - Production (read-only + emergency write)

Active Environment: ${ENVIRONMENTS[$ENV_INDEX]}
Active Mode: ${MODES[$MODE_INDEX]}
EOF
            ;;

        view:toml)
            local toml_path="${TETRA_DIR}/org/${TETRA_ORG}/tetra.toml"
            if [[ -f "$toml_path" ]]; then
                echo "Organization: $TETRA_ORG"
                echo "File: ${toml_path/$HOME/~}"
                echo "────────────────────────────────────────────────────────────"
                head -20 "$toml_path"
                echo ""
                echo "Total lines: $(wc -l < "$toml_path")"
            else
                echo "TOML file not found: $toml_path"
                echo ""
                echo "Organization: $TETRA_ORG (not found)"
                echo "This action reads from @local"
                return 1
            fi
            ;;

        check:local)
            if command -v tsm &>/dev/null; then
                echo "exec_at: @local"
                echo ""
                tsm list 2>&1 | head -15
            else
                echo "TSM not installed locally"
                return 1
            fi
            ;;

        check:remote)
            cat <<EOF
This action would:
  exec_at:     @local
  source_at:   $context
  operation:   ssh $context 'tsm list'

In production, this would execute 'tsm list' on the remote endpoint.

Example output:
  ✓ web-app (running, pid: 12345)
  ✓ api-server (running, pid: 12346)
  ○ worker (stopped)
EOF
            ;;

        view:logs)
            cat <<EOF
This action would:
  exec_at:     @local
  source_at:   $context
  operation:   ssh $context 'tail -n 20 ~/logs/tetra.log'

In production, this would fetch remote log files via SSH.

Example output:
  2025-10-12 14:23:45 [INFO] Service started
  2025-10-12 14:24:10 [INFO] Request processed
  2025-10-12 14:25:33 [WARN] High memory usage
EOF
            ;;

        fetch:config)
            cat <<EOF
This action would:
  exec_at:     @local
  source_at:   $context
  target_at:   @local
  inputs:      (none)
  effects:     @local[~/Downloads/config.toml]

Command:
  scp $context:~/tetra.toml ~/Downloads/config-$context.toml

Status: Demo mode - no actual transfer performed
EOF
            ;;

        push:config)
            cat <<EOF
This action would:
  exec_at:     @local
  source_at:   @local
  target_at:   $context
  inputs:      @local[~/tetra.toml]
  effects:     $context[~/tetra.toml.new]

Command:
  scp ~/tetra.toml $context:~/tetra.toml.new

⚠️  Safety: Writes to .new file, requires manual activation
Status: Demo mode - no actual transfer performed
EOF
            ;;

        sync:files)
            cat <<EOF
This action would:
  exec_at:     @local
  source_at:   @local
  target_at:   $context
  inputs:      @local[~/src/tetra/]
  effects:     $context[~/src/tetra/]

Command:
  rsync -avz --delete ~/src/tetra/ $context:~/src/tetra/

⚠️  Caution: Syncs entire directory tree
Status: Demo mode - no actual transfer performed
EOF
            ;;

        *)
            echo "Action not implemented: $action"
            return 1
            ;;
    esac
}
