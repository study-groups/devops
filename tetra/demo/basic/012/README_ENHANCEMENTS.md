# Demo 012: TES-Compliant Action Execution

## Overview

Demo 012 now implements **strong action feedback** following the Tetra Endpoint Specification (TES). Every action execution provides clear visual feedback about:

1. **Action Signature** - What the action does and where output goes
2. **Execution Phases** - Start, validation, execution, completion
3. **Timing Information** - Millisecond-precise duration tracking
4. **Unified Logging** - All actions logged to `tetra.jsonl`
5. **Success/Failure States** - Clear indication of outcome

## What Changed

### Before
```
Action: [test:demo] ● idle :: @tui[content],@tui[footer],@app[stdout] (3/5)
```
- Actions executed silently
- No timing information
- No execution trace
- No unified logging

### After
```
Action: [test:demo] ● idle :: () → @tui[content],@tui[footer],@app[stdout] (3/5)
```
- Action signature displayed with `() → outputs`
- Execution banners show start/complete
- Millisecond timing for every action
- All executions logged to `tetra.jsonl`
- Visual feedback during execution phases

## New Features

### 1. Execution Banners

When you execute an action, you now see:

**Start Banner:**
```
┌─ EXECUTING ACTION ──────────────────────────────────────┐
│ show:demo :: () → @tui[content]
│ Status: ▶ Executing...
└─────────────────────────────────────────────────────────┘
```

**Success Banner:**
```
┌─ EXECUTION COMPLETE ────────────────────────────────────┐
│ show:demo :: () → @tui[content]
│ Status: ✓ Success
│ Duration: 42ms
└─────────────────────────────────────────────────────────┘
```

**Error Banner (if failed):**
```
┌─ EXECUTION FAILED ──────────────────────────────────────┐
│ test:demo :: () → @tui[content],@tui[footer],@app[stdout]
│ Status: ✗ Error
│ Error: Validation failed
│ Duration: 15ms
└─────────────────────────────────────────────────────────┘
```

### 2. Unified Logging

All actions are logged to `$TETRA_DIR/logs/tetra.jsonl` (or `/tmp/logs/tetra.jsonl`):

```json
{"timestamp":"2025-10-04T17:30:45Z","module":"tui","verb":"show","subject":"demo","status":"try","exec_at":"@local","metadata":{}}
{"timestamp":"2025-10-04T17:30:45Z","module":"tui","verb":"show","subject":"demo","status":"success","exec_at":"@local","metadata":{"duration_ms":42}}
```

### 3. Execution Log Viewer

Press **`l`** to view recent executions:

```
Recent Action Executions (Last 10)
────────────────────────────────────────────────────────
○ 17:30:45 tui.show:demo - try
✓ 17:30:45 tui.show:demo - success
○ 17:31:02 tui.test:demo - try
✓ 17:31:03 tui.test:demo - success

Full log: /tmp/logs/tetra.jsonl
```

### 4. Action Signatures

Actions now display their full TES-compliant signature:

```
action :: (inputs) → @outputs
```

Example:
```
show:demo :: () → @tui[content]
test:demo :: () → @tui[content],@tui[footer],@app[stdout]
```

## File Structure

```
tetra/demo/basic/012/
├── demo.sh                  # Main demo (enhanced with executor)
├── action_executor.sh       # NEW: TES-compliant execution engine
├── action_registry.sh       # Action declarations
├── action_state.sh          # State machine
├── action_preview.sh        # Preview/validation
├── router.sh               # Output routing
├── modal.sh                # Error modals
├── tui.conf                # TUI configuration
└── README_ENHANCEMENTS.md  # This file
```

## TES Compliance

This demo now implements:

### ✅ Action Lifecycle (Section 5.1)
```
Template → Qualified → Execute
  declare    resolve      validate + run
```

### ✅ Action Signature (Section 5.5)
```
ACTION :: Input* → Output+ where Effect*
```

Example:
```
show:demo :: () → @tui[content]
test:demo :: () → @tui[content],@tui[footer],@app[stdout]
  where Log(@app[stdout])
```

### ✅ Unified Logging (Section 7)
```bash
tetra_log <module> <verb> <subject> <status> [metadata_json]
```

All executions logged to single `tetra.jsonl` file with:
- `try` - Action initiated
- `success` - Action completed
- `fail` - Action failed

### ✅ Progressive Resolution (Section 2)
While this demo uses simple actions, the framework supports:
```
Symbol → Address → Channel → Connector → Handle → Locator → Binding → Plan
```

## Usage

### Running the Demo

```bash
cd /Users/mricos/src/devops/tetra/demo/basic/012
./demo.sh
```

### Keyboard Shortcuts

**Navigation:**
- `e`/`E` - Cycle environments (APP, DEV)
- `d`/`D` - Cycle modes (Learn, Try, Test)
- `f`/`F` - Cycle actions
- `Enter` - Execute current action

**Views:**
- `r` - Show routing table (all action signatures)
- `s` - Show app stream (@app[stdout])
- `l` - **NEW**: Show execution log (tetra.jsonl)
- `c` - Clear content buffer

**Other:**
- `q` - Quit demo

### Try This Sequence

1. **Start the demo**: `./demo.sh`
2. **Execute show:demo**: Press `Enter` (immediate action)
   - Notice the execution banner
   - See timing information
3. **Navigate to test:demo**: Press `f` twice
   - Notice it shows `○ pending` (deferred action)
4. **View preview**: Press `Enter`
   - See what the action CAN and CANNOT do
5. **Execute**: Press `Enter` again
   - Watch the execution phases
   - See output routed to multiple targets
6. **View execution log**: Press `l`
   - See all actions logged with try/success
   - Notice millisecond timing

## Integration with Full Tetra System

This demo demonstrates the action execution model that will be used across all Tetra modules:

### TKM (Tetra Key Manager)
```bash
# Action declaration
declare_action "rekey" \
    "module=tkm" \
    "inputs=source:locator,target:locator" \
    "routes=@tui[content],@tui[footer]"

# Execution with feedback
tkm.rekey:local_to_dev ::
  (@local:~/.ssh/id_rsa.pub) →
  (@dev:~/.ssh/authorized_keys)
```

### Deploy
```bash
# Action with remote execution
deploy.push:staging ::
  (@local:./dist) →
  (@staging:/var/www/app)
  where SSH(@staging) ∧ Log(@tetra[actions])
```

### TSM (Tetra Service Manager)
```bash
# Action affecting services
tsm.restart:devpages ::
  (@staging:devpages-3000) →
  @tui[footer]
  where Effect(service_restart) ∧ Log(@tetra[actions])
```

## Benefits of Strong Feedback

1. **Debugging** - Clear execution trace for troubleshooting
2. **Accountability** - Every action logged to tetra.jsonl
3. **Transparency** - Users see exactly what's happening
4. **Performance** - Timing information helps identify slow actions
5. **Trust** - Clear can/cannot previews before execution
6. **Compliance** - Follows TES specification exactly

## Next Steps

1. **Integrate with NodeHolder**: Use NH data for real deployment actions
2. **Add Remote Execution**: Execute actions on @dev, @staging servers
3. **Implement Bindings**: Full progressive resolution from symbols to plans
4. **Add Input Actions**: Actions that take user input (locators, strings)
5. **Create Action Composer**: Chain actions together

## Related Documentation

- **TES Specification**: `tetra/docs/Tetra_Endpoint_Specification.md`
- **NodeHolder Setup**: `~/nh/nodeholder/QUICKSTART.md`
- **Tetra Integration**: `~/src/devops/tetra/orgs/nodeholder/README.md`

## Questions?

The action execution model is now fully TES-compliant. Every action:
- Declares its signature (inputs → outputs)
- Logs to unified tetra.jsonl
- Shows execution phases visually
- Tracks timing information
- Routes output to declared targets

This provides the foundation for building complex deployment workflows with full observability and accountability.
