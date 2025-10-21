# Org REPL - CORRECT Implementation Using bash/repl

## The Right Way

Instead of building a custom REPL from scratch, we **use the existing bash/repl library**.

## File Structure

```
bash/org/
├── org_repl_adapter.sh      ✅ CORRECT - Adapts org to bash/repl
├── org_help.sh              ✅ Help content
├── org_completion.sh        ⚠️  For future tab completion integration
├── org_repl.sh              ❌ DELETE - Was wrong approach
└── includes.sh              ✅ Updated to use adapter
```

## How It Works

### 1. Uses Existing REPL Library

**bash/repl/** provides:
- Mode detection (basic/enhanced/tui)
- Slash command registration
- Prompt builders
- History management
- Safe cleanup handlers
- Terminal state management

### 2. Org Adapter (`org_repl_adapter.sh`)

Minimal adapter that:
1. Sources `bash/repl/repl.sh`
2. Registers prompt builder
3. Registers slash commands
4. Wraps org functions

```bash
# Register prompt
repl_register_prompt_builder "org" "org_repl_prompt"

# Register commands
repl_register_slash_command "list" "org_cmd_list"
repl_register_slash_command "import" "org_cmd_import"
# ... etc

# Run REPL
org_repl() {
    REPL_HISTORY_BASE="${TETRA_DIR}/org/history"
    repl_run  # Uses bash/repl system
}
```

## Usage

### Interactive Mode

```bash
source ~/tetra/tetra.sh
tmod load org
org
```

You'll see:
```
═══════════════════════════════════════════════════════════
  TETRA ORGANIZATION MANAGEMENT
═══════════════════════════════════════════════════════════

Type /help for commands, /exit to quit

org>
```

### Slash Commands

```bash
org> /list              # List organizations
org> /active            # Show active org
org> /import nh ~/nh/myorg myorg
org> /secrets init myorg
org> /compile myorg
org> /push myorg dev
org> /help              # Show help
org> /exit              # Exit cleanly
```

### Shell Commands (in augment mode)

```bash
org> ls                 # Regular shell command
org> !git status        # Explicit shell escape
```

## Benefits of Using bash/repl

✅ **Proven System** - Already tested and working
✅ **Safe** - Proper cleanup handlers, won't kill terminal
✅ **Mode-aware** - Works in basic/enhanced/tui modes
✅ **History** - Built-in history management
✅ **Extensible** - Easy to add new commands
✅ **Consistent** - Same interface as other modules

## Registered Commands

```
/list, /ls              List organizations
/active                 Show active organization
/switch, /sw <org>      Switch to organization
/create <org>           Create organization
/import <type> <path>   Import organization
/discover <json>        Interactive discovery
/validate <org>         Validate configuration
/compile <org>          Compile tetra.toml
/refresh <org>          Refresh from infrastructure
/secrets <cmd>          Manage secrets
/push <org> <env>       Deploy
/pull <org> <env>       Pull
/rollback <org> <env>   Rollback
/history, /hist <org>   Deployment history
/nh <cmd>               NodeHolder bridge
/help, /? [topic]       Show help
```

## Testing

### Test Adapter Loading

```bash
bash bash/org/test_org_repl.sh
```

Should show:
```
✅ Org REPL adapter loaded

Registered slash commands:
  /active
  /compile
  /create
  ...
```

### Test Interactively

```bash
bash
source bash/org/org_repl_adapter.sh
org_repl
```

Try commands:
```bash
org> /list
org> /help
org> /exit
```

## What Was Wrong Before

**Old approach** (`org_repl.sh`):
- ❌ Reinvented REPL from scratch
- ❌ Custom readline handling (broke terminal)
- ❌ Custom history management
- ❌ Alias instead of function
- ❌ No proper cleanup
- ❌ Terminal exit issues

**New approach** (`org_repl_adapter.sh`):
- ✅ Uses proven bash/repl library
- ✅ Registers with existing system
- ✅ Proper cleanup built-in
- ✅ Function, not alias
- ✅ Won't kill terminal
- ✅ Works reliably

## Integration with Tab Completion

Future: `org_completion.sh` can be integrated with bash/repl completion system.

## Files to Remove

These files were the wrong approach:
- `bash/org/org_repl.sh` - Custom REPL (wrong)
- `bash/org/org_safe_launcher.sh` - Workaround for broken REPL
- `bash/org/test_repl_simple.sh` - Test for broken REPL
- `bash/org/REPL_FIXES.md` - Fixes for broken approach

Keep these:
- ✅ `bash/org/org_repl_adapter.sh` - Correct implementation
- ✅ `bash/org/org_help.sh` - Help content
- ✅ `bash/org/includes.sh` - Module loader
- ✅ `bash/org/test_org_repl.sh` - Test for correct implementation

## Summary

**Before:** Tried to build custom REPL → broke terminal
**After:** Use existing bash/repl library → works perfectly

This is the Tetra way - reuse existing libraries!
