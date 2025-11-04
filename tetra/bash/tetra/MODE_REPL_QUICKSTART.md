# Mode-Module-REPL Quick Start

## Launch

```bash
source ~/tetra/tetra.sh
tetra tui
```

## Navigation Flow

```
1. TUI Shell (Navigation)
   ├─ e → Cycle environment (Local/Dev/Staging/Production)
   ├─ m → Cycle mode (Inspect/Transfer/Execute)
   ├─ a → Cycle action
   └─ Enter → Drop into REPL

2. Mode REPL (Work)
   ├─ Ctrl-Tab → Switch to next module (phase-shift!)
   ├─ Shift-Ctrl-Tab → Switch to previous module
   ├─ Type actions → verb:noun format
   └─ ESC → Return to TUI shell

3. Back to TUI Shell
   └─ Change context and repeat
```

## Example Session

### Inspect Local Services

```
1. TUI: Press 'e' until "Local"
2. TUI: Press 'm' until "Inspect"
   → Shows modules: org, logs
   → Shows actions: view:orgs view:toml...

3. TUI: Press Enter
   → Enters Mode REPL with org module (warm/amber temperature)

4. REPL: Type "actions" + Enter
   → Lists available actions

5. REPL: Type "view:orgs" + Enter
   → Shows organization list

6. REPL: Press Ctrl-Tab
   → Switches to logs module (cool/blue temperature - phase-shift!)

7. REPL: Type "view:logs" + Enter
   → Shows recent logs

8. REPL: Press ESC
   → Returns to TUI shell
```

### Deploy to Dev

```
1. TUI: Press 'e' until "Dev"
2. TUI: Press 'm' until "Execute"
   → Shows modules: tsm, deploy
   → Shows actions: start:service deploy:dev...

3. TUI: Press Enter
   → Enters Mode REPL with tsm module (neutral/green temperature)

4. REPL: Press Ctrl-Tab
   → Switches to deploy module (electric/purple temperature)

5. REPL: Type "deploy:dev" + Enter
   → Triggers deployment to dev environment

6. REPL: Type "context" + Enter
   → Shows current environment and module info

7. REPL: Press ESC
   → Returns to TUI
```

## Key Bindings Reference

### TUI Shell
| Key | Action |
|-----|--------|
| `e` | Cycle environment |
| `m` | Cycle mode |
| `a` | Cycle action |
| `Enter` | Drop into REPL |
| `:` | Command mode |
| `u` | Unicode playground |
| `h` | Cycle header size |
| `o` | Toggle animation |
| `c` | Clear content |
| `q` | Quit |

### Mode REPL
| Key | Action |
|-----|--------|
| `Ctrl-Tab` | Next module (phase-shift) |
| `Shift-Ctrl-Tab` | Previous module |
| `ESC` | Return to TUI |
| `Enter` | Execute command |

### REPL Commands
| Command | Description |
|---------|-------------|
| `help` | Show REPL help |
| `context` | Show current Env×Mode |
| `modules` | List available modules |
| `actions` | List available actions |
| `verb:noun` | Execute action |
| `exit`, `quit`, `q` | Exit REPL |

## Module Temperatures

Watch for color phase-shifts when pressing Ctrl-Tab:

| Module | Temperature | Marker | Feel |
|--------|-------------|--------|------|
| **org** | warm (amber) | ⁘ | Inviting, organizational |
| **tsm** | neutral (green) | ◇ | Balanced, operational |
| **logs** | cool (blue) | ● | Analytical, focused |
| **deploy** | electric (purple) | ◉ | Energetic, action |

## Context Matrix

Different Env×Mode combinations give you different modules and actions:

| Environment | Mode | Modules | Example Actions |
|-------------|------|---------|-----------------|
| **Local** | Inspect | org, logs | view:toml, view:logs |
| Local | Transfer | org, deploy | import:json, build:local |
| Local | Execute | org, tsm | compile:toml, start:service |
| **Dev** | Inspect | org, tsm, logs | view:env, status:service |
| Dev | Transfer | org, deploy | push:config, upload:build |
| Dev | Execute | tsm, deploy | restart:service, deploy:dev |
| **Staging** | Inspect | org, logs | view:env, search:logs |
| Staging | Transfer | deploy | push:release |
| Staging | Execute | deploy | deploy:staging |
| **Production** | Inspect | org, logs | view:status, view:logs |
| Production | Transfer | deploy | backup:current |
| Production | Execute | deploy | deploy:prod |

## Tips

### Phase-Shift Transitions

When you press Ctrl-Tab, notice:
1. Brief visual indicator (markers: `⁘ → ●`)
2. Screen clears
3. New temperature loads
4. Colors shift to new module's palette
5. Prompt updates with new module marker

This is the **phase-shift** - each module has its own visual atmosphere.

### Action Format

All actions follow `verb:noun` pattern:
- ✓ `view:logs`
- ✓ `deploy:dev`
- ✓ `start:service`
- ✗ `view_logs`
- ✗ `deploy_to_dev`

### Context Awareness

The same action can behave differently based on environment:
- `view:env` in Local → shows local environment
- `view:env` in Dev → shows remote dev environment via TES

### Module Switching

Only works when multiple modules available:
- `Dev:Inspect` has 3 modules → Ctrl-Tab cycles through all 3
- `Staging:Execute` has 1 module → Ctrl-Tab does nothing

## Troubleshooting

**Ctrl-Tab not working?**
- Some terminals don't support it
- Try in xterm, modern terminals
- Check with: `keychord_test_ctrl_tab` from bash

**Colors not showing?**
- Ensure 256-color terminal support
- Try: `echo $TERM` (should be xterm-256color or similar)

**Module not available?**
- Check context (some modules only in certain Env×Mode combos)
- Type `modules` in REPL to see what's available
- Type `context` to see where you are

**REPL won't exit?**
- Press ESC (not Ctrl-C)
- Or type `quit` + Enter

## Next Steps

Once comfortable with basic navigation:

1. Explore all Env×Mode combinations
2. Try Ctrl-Tab switching between modules
3. Notice temperature phase-shifts
4. Execute actions in different contexts
5. Use `:` command mode in TUI for advanced features

---

⁘ **Tetra Mode-Module-REPL System**
⁘ Full key-chord navigation
⁘ Phase-shift temperatures
⁘ TES-compliant actions
