# Demo 013: TES Resolution System

Interactive demonstration of the Tetra Endpoint Specification (TES) progressive resolution system.

## What This Demo Shows

Progressive resolution through 8 levels:

```
Symbol → Address → Channel → Connector → Handle → Locator → Binding → Plan
  @staging    24.199.72.22    dev@host    root:dev@host    ✓validated    :~/path    write()    ssh cmd
```

## The `resolve` Module

TES is implemented as the `resolve` module in `bash/resolve/`:

- **resolve.sh** - Main entry point and orchestration
- **symbol.sh** - Level 0-1: Symbol → Address resolution
- **connector.sh** - Level 2-4: Channel → Connector → Handle
- **binding.sh** - Level 5-6: Locator → Binding (operation intent)
- **plan.sh** - Level 7: Binding → Executable Plan
- **validate.sh** - Pre-flight validation and connectivity tests

## Running the Demo

```bash
./demo/basic/013/resolve_demo.sh
```

## Demo Actions

### Navigation
- `step` - Progress to next resolution level
- `back` - Go back one level
- `reset` - Start over from Symbol level

### Information
- `info` - Explain what happens at current level
- `symbols` - List available symbols from org config

### Validation
- `validate` - Run validation at current level (Level 3+)
- `test` - Test connectivity (Level 4+)

### Execution
- `execute` - Execute the plan (Level 7 only)

### Configuration
- `setpath` - Set resource path
- `setop` - Toggle operation (read/write)

## Key Concepts

### Each Level Adds Specificity

| Level | Name      | Adds                          | Example                                    |
|-------|-----------|-------------------------------|--------------------------------------------|
| 0     | Symbol    | Semantic meaning              | `@staging`                                 |
| 1     | Address   | Network location              | `24.199.72.22`                             |
| 2     | Channel   | User identity                 | `dev@24.199.72.22`                         |
| 3     | Connector | Authentication                | `root:dev@24.199.72.22 -i ~/.ssh/id_rsa`  |
| 4     | Handle    | Reachability validation       | ✓ SSH pre-flight passed                    |
| 5     | Locator   | Resource path                 | `dev@24.199.72.22:~/.ssh/authorized_keys`  |
| 6     | Binding   | I/O operation                 | `write(locator)`                           |
| 7     | Plan      | Executable command            | Full SSH command string                    |

### Dual-Role Authentication

The connector level supports dual-role syntax:

```
auth_user:work_user@host -i key
    ↓          ↓
   root       dev
```

This allows:
- Authenticate as `root` (has SSH access)
- Execute commands as `dev` (the working user)

Implemented via: `ssh root@host "sudo -u dev <command>"`

## Module Integration

Other tetra modules use `resolve` like this:

```bash
source "$TETRA_SRC/bash/resolve/resolve.sh"

# Full resolution
plan=$(resolve_symbol "@staging" "~/.ssh/authorized_keys" "write")
execute_plan "$plan" "$key_content"

# Partial resolution
declare -A result
resolve_to_level "@staging" 4 result
if [[ "${result[handle_status]}" == "validated" ]]; then
    echo "Connection ready: ${result[connector]}"
fi

# Quick validation
if is_fully_qualified "@staging" "~/path" "read"; then
    echo "Ready to execute"
fi
```

## Configuration Required

The resolve module reads from organization TOML files:

```toml
# ~/tetra/orgs/{org}/{org}.toml

[symbols]
"@staging" = { address = "24.199.72.22", type = "remote" }

[connectors]
"@staging" = {
    auth_user = "root",
    work_user = "dev",
    host = "24.199.72.22",
    auth_key = "~/.ssh/id_rsa"
}
```

## Example Flow

1. Start at Level 0: `@staging` (semantic symbol)
2. `step` → Level 1: Resolves to `24.199.72.22` (address)
3. `step` → Level 2: Adds user → `dev@24.199.72.22` (channel)
4. `step` → Level 3: Adds auth → `root:dev@24.199.72.22 -i key` (connector)
5. `validate` → Tests SSH connectivity
6. `step` → Level 4: Connector validated (handle)
7. `step` → Level 5: Adds path → `dev@24.199.72.22:~/.ssh/authorized_keys` (locator)
8. `step` → Level 6: Adds operation → `write(locator)` (binding)
9. `step` → Level 7: Generates full SSH command (plan)
10. `execute` → Runs the plan

## Why "resolve"?

The module is called `resolve` rather than `tes` because:

- Describes what it does (resolves symbols to plans)
- Unix convention (DNS resolution, path resolution)
- Short, clear, no namespace conflicts
- Natural function names: `resolve_symbol()`, `resolve_to_level()`

The module still implements TES 2.1 specification completely.
