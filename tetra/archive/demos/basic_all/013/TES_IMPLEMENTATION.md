# TES (Tetra Endpoint Specification) Implementation

## Overview

Demo 013 now includes full TES v2.1 remote execution with 8-phase resolution pipeline.

## Features Implemented

### 1. **TES Resolver** (`tes_resolver.sh`)
Parses `~/tetra/org/pixeljam-arcade/tetra.toml` and resolves remote connections through 8 phases:

- **Phase 0: Symbol** - Logical name (@dev, @staging, @prod)
- **Phase 1: Address** - IP address/hostname resolution
- **Phase 2: Channel** - User@Host combination
- **Phase 3: Connector** - Dual-role authentication (auth_user:work_user@host)
- **Phase 4: Handle** - Validated connector (connection test)
- **Phase 5: Locator** - Full resource path (user@host:~/path)
- **Phase 6: Binding** - Operation + validation requirements
- **Phase 7: Plan** - Executable SSH command

### 2. **Remote Action Execution**

All monitoring and control actions now support remote execution when `env=Dev`:

- `status:tsm` - Check TSM status on remote server
- `status:watchdog` - Check watchdog on remote server
- `start:tsm` - Start TSM remotely
- `stop:tsm` - Stop TSM remotely
- `start:watchdog` - Start watchdog remotely
- `stop:watchdog` - Stop watchdog remotely

### 3. **Configuration Management**

- `edit:toml` - Edit tetra.toml with vim (System > Control mode)
- `view:toml` - View current configuration (System > Monitor mode)

## TES Configuration Format

From `~/tetra/org/pixeljam-arcade/tetra.toml`:

```toml
[symbols]
"@dev" = { address = "137.184.226.163", droplet = "pxjam-arcade-dev01", type = "remote" }
"@staging" = { address = "24.199.72.22", droplet = "pxjam-arcade-qa01", type = "remote" }
"@prod" = { address = "164.90.247.44", droplet = "pxjam-arcade-prod01", type = "remote" }

[connectors]
# Dual-role authentication: SSH as auth_user, work as work_user
"@dev" = {
    auth_user = "root",              # SSH authentication user
    work_user = "dev",               # Working user (su target)
    host = "137.184.226.163",
    auth_key = "~/.ssh/id_rsa"
}
```

## Example: Remote Execution

When you execute `status:tsm` in **Dev** environment:

```
═══════════════════════════════════════════════════════════
TES Resolution Pipeline (8 Phases)
Action: status:tsm → @dev
═══════════════════════════════════════════════════════════

Phase 0: Symbol (Logical Name)
  symbol = "@dev"
  type   = remote

Phase 1: Address (IP/Hostname)
  address = "137.184.226.163"
  droplet = "pxjam-arcade-dev01"

Phase 2: Channel (User@Host combo)
  (Resolved in Phase 3 connector)

Phase 3: Connector (Dual-role auth)
  auth_user = "root"  # SSH authentication user
  work_user = "dev"  # Working user (su target)
  host      = "137.184.226.163"
  auth_key  = "/Users/mricos/.ssh/id_rsa"

Phase 4: Handle (Validated connector)
  Testing connection to root@137.184.226.163...
  ✓ Connection validated

Phase 5: Locator (Full resource path)
  locator = "dev@137.184.226.163:~/tetra"

Phase 6: Binding (Operation + Locator)
  operation = execute
  command   = "source ~/tetra/tetra.sh && tsm ls"
  requires  = source ~/tetra/tetra.sh

Phase 7: Plan (Executable command)
  Full SSH command:

  ssh -i "/Users/mricos/.ssh/id_rsa" -o StrictHostKeyChecking=no \
      -o ConnectTimeout=5 root@137.184.226.163 \
      "su - dev -c 'source ~/tetra/tetra.sh && tsm ls'"

═══════════════════════════════════════════════════════════
```

## Usage

### Navigate to Dev Environment
1. Press `e` to cycle through environments (System → Local → Dev)
2. Press `d` to select mode (Monitor, Control, Deploy)
3. Press `f` to select action
4. Press `Enter` to execute

### Execute Remote Commands
- All actions in **Dev** environment automatically use TES remote execution
- Full 8-phase resolution displayed before execution
- Results shown in content area
- Errors include diagnostic information

### Edit Configuration
1. Navigate to System > Control
2. Select `edit:toml` action
3. Press Enter to open vim
4. Edit connectors, symbols, or environments
5. Save and exit vim

## Testing

Run the test script:
```bash
cd /Users/mricos/src/devops/tetra/demo/basic/013
./test_tes.sh
```

This validates:
- ✓ TOML path resolution
- ✓ Connector parsing
- ✓ SSH command construction
- ✓ Full 8-phase TES pipeline
- ✓ Connection validation

## Semantic Variables

Each TES phase uses semantic variable names from tetra.toml:

| Phase | Variables | Source |
|-------|-----------|--------|
| 0: Symbol | `symbol`, `type` | `[symbols]` section |
| 1: Address | `address`, `droplet` | `[symbols]` section |
| 2: Channel | (derived from connector) | - |
| 3: Connector | `auth_user`, `work_user`, `host`, `auth_key` | `[connectors]` section |
| 4: Handle | connection status | Runtime test |
| 5: Locator | `work_user@host:path` | Derived |
| 6: Binding | `operation`, `command`, `requires` | Action metadata |
| 7: Plan | Full SSH command string | Constructed |

## Architecture

```
demo.sh
  ├─ tes_resolver.sh         # TES resolution functions
  ├─ action_registry.sh      # Action declarations
  ├─ actions_impl.sh         # Action implementations
  │   └─ Remote detection: if env=="Dev" then TES
  └─ action_executor.sh      # Execution lifecycle
```

## Key Functions

**TES Resolver:**
- `get_toml_path()` - Locate tetra.toml
- `resolve_connector(symbol)` - Parse connector from TOML
- `build_ssh_command(symbol, command)` - Construct SSH command
- `execute_remote(symbol, command)` - Execute and capture output
- `show_tes_resolution(action, symbol, command)` - Display 8 phases
- `get_env_symbol(env)` - Map environment name to symbol

**Action Pattern:**
```bash
action_status_tsm() {
    local env="${1:-Local}"

    if [[ "$env" == "Dev" ]]; then
        # Remote execution via TES
        local symbol=$(get_env_symbol "$env")
        local command="source ~/tetra/tetra.sh && tsm ls"
        show_tes_resolution "status:tsm" "$symbol" "$command"
        execute_remote "$symbol" "$command"
    else
        # Local execution
        tsm ls
    fi
}
```

## TES Command Examples

### Basic Commands

All TES operations follow a consistent pattern of progressive resolution through 8 phases.

#### 1. Validate TES Connectors

Test connectivity to all configured environments:

```bash
# From System > Control menu
Action: validate:tes

# Output shows:
# - Connector parsing results
# - SSH key validation
# - Connection tests for @dev, @staging, @prod
```

This action demonstrates TES requirements in its declaration:
```bash
tes_level=handle         # Requires validated connection
tes_target=@dev          # Tests @dev environment
tes_operation=execute    # Executes test command
tes_requires=connector   # Needs connector resolved
```

#### 2. Remote Status Checks

Check TSM status on remote server:

```bash
# Navigate to: Dev > Monitor > status:tsm
Action: status:tsm

# TES Resolution shows:
Phase 0: Symbol (@dev)
Phase 1: Address (137.184.226.163)
Phase 2: Channel (dev@host)
Phase 3: Connector (root:dev@host -i key)
Phase 4: Handle (✓ validated)
Phase 5: Locator (dev@host:~/tetra)
Phase 6: Binding (execute: tsm ls)
Phase 7: Plan (full SSH command)
```

#### 3. Remote Control Operations

Start/stop services remotely:

```bash
# Dev > Control > start:tsm
# Executes: ssh -i key root@host "su - dev -c 'source ~/tetra/tetra.sh && tsm start'"

# Dev > Control > stop:tsm
# Executes: ssh -i key root@host "su - dev -c 'source ~/tetra/tetra.sh && tsm stop'"
```

#### 4. Deployment Actions

Deploy to remote environments:

```bash
# Dev > Deploy > deploy:dev
declare_action "deploy_dev" \
    tes_level=plan \
    tes_target=@dev \
    tes_operation=write \
    tes_requires=connector

# Dev > Deploy > deploy:staging
declare_action "deploy_staging" \
    tes_level=plan \
    tes_target=@staging \
    tes_operation=write \
    tes_requires=handle    # Requires validated connection

# Dev > Deploy > deploy:prod
declare_action "deploy_prod" \
    tes_level=plan \
    tes_target=@prod \
    tes_operation=write \
    tes_requires=binding   # Highest safety level
```

### TES Metadata Fields

Every action that uses TES declares these fields:

| Field | Purpose | Example Values |
|-------|---------|----------------|
| `tes_level` | Resolution level needed | local, symbol, connector, handle, binding, plan |
| `tes_target` | Target environment | @dev, @staging, @prod, @local |
| `tes_operation` | Operation type | read, write, execute |
| `tes_requires` | Minimum resolution | connector, handle, binding |

### Configuration Edit

Edit the tetra.toml to modify connectors:

```bash
# System > Control > edit:toml
# Opens vim with: ~/tetra/org/pixeljam-arcade/tetra.toml

# After editing, test with:
# System > Control > validate:tes
```

## Next Steps

- Add TES resolution for Staging/Prod environments
- Implement deployment actions with TES file transfers
- Add TOML validation on edit
- Implement connection pooling for performance
