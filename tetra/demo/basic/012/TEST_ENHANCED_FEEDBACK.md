# Testing Enhanced Action Feedback

## Quick Test

```bash
cd /Users/mricos/src/devops/tetra/demo/basic/012
./demo.sh
```

## What You'll See

### 1. Enhanced Header Line
**Before:**
```
Action: [test:demo] ● idle :: @tui[content],@tui[footer],@app[stdout] (3/5)
```

**After:**
```
Action: [test:demo] ● idle :: () → @tui[content],@tui[footer],@app[stdout] (3/5)
```

The `() →` shows the TES-compliant signature format:
- `()` = inputs (empty for this action)
- `→` = flow operator
- `@tui[content],@tui[footer],@app[stdout]` = output routing

### 2. Execution Banner

When you press Enter on any action, you'll see:

**Phase 1: Start**
```
┌─ EXECUTING ACTION ──────────────────────────────────────┐
│ show:demo :: () → @tui[content]
│ Status: ▶ Executing...
└─────────────────────────────────────────────────────────┘

Preparing execution...
```

**Phase 2: Complete**
```
┌─ EXECUTION COMPLETE ────────────────────────────────────┐
│ show:demo :: () → @tui[content]
│ Status: ✓ Success
│ Duration: 42ms
└─────────────────────────────────────────────────────────┘

[action output here]
```

### 3. Execution Log (Press 'l')

```
Recent Action Executions (Last 10)
────────────────────────────────────────────────────────

○ 17:45:23 tui.show:demo - try
✓ 17:45:23 tui.show:demo - success
○ 17:45:30 tui.test:demo - try
✓ 17:45:31 tui.test:demo - success
○ 17:45:35 tui.configure:demo - try
✓ 17:45:35 tui.configure:demo - success

Full log: /tmp/logs/tetra.jsonl
```

### 4. Timing in Footer

After execution:
```
✓ Action completed in 42ms
```

Or for test:demo specifically:
```
✓ Test completed in 68ms with 3/3 checks passed
```

## Test Sequence

Follow this sequence to see all features:

### Test 1: Immediate Action (show:demo)
1. Start demo: `./demo.sh`
2. Press `Enter` immediately
3. **Watch for:**
   - Execution banner appears
   - Duration shown (should be ~30-50ms)
   - Success banner
   - Footer shows completion time

### Test 2: Deferred Action (configure:demo)
1. Press `f` to cycle to configure:demo
2. **First Enter:**
   - Shows preview with can/cannot
   - State changes to `○ pending`
3. **Second Enter:**
   - Execution banner
   - Multiple routing targets shown
   - Check footer for completion

### Test 3: Complex Action (test:demo)
1. Press `f` until you reach test:demo
2. **First Enter:** Preview
3. **Second Enter:** Execute
4. **Watch for:**
   - Routes to 3 targets: content, footer, stdout
   - Footer shows "3/3 checks passed"
   - Execution banner with timing

### Test 4: View Execution Log
1. After running several actions, press `l`
2. **Verify:**
   - See try/success pairs for each action
   - Timestamps are accurate
   - Log file path shown

### Test 5: View App Stream
1. Execute configure:demo or test:demo
2. Press `s` to view app stream
3. **Verify:**
   - Actions that route to @app[stdout] appear
   - Timestamped entries

## Expected Behavior

### Immediate Actions (show:*)
- Execute on Enter without preview
- Show execution banner
- Display timing
- Auto-reset to idle after completion

### Deferred Actions (configure:*, test:*)
- First Enter: Show preview
- Second Enter: Execute
- Show can/cannot capabilities
- Stay in success state until navigation

## Log File Location

Logs are written to:
```bash
$TETRA_DIR/logs/tetra.jsonl
```

Or if TETRA_DIR not set:
```bash
/tmp/logs/tetra.jsonl
```

View it directly:
```bash
cat /tmp/logs/tetra.jsonl | jq .
```

Example entries:
```json
{
  "timestamp": "2025-10-04T17:45:23Z",
  "module": "tui",
  "verb": "show",
  "subject": "demo",
  "status": "try",
  "exec_at": "@local",
  "metadata": {}
}
{
  "timestamp": "2025-10-04T17:45:23Z",
  "module": "tui",
  "verb": "show",
  "subject": "demo",
  "status": "success",
  "exec_at": "@local",
  "metadata": {
    "duration_ms": 42
  }
}
```

## Troubleshooting

### No execution banner appears
- Check that action_executor.sh was sourced
- Verify TETRA_DIR is set or /tmp is writable

### Timing shows 0ms
- System may not support millisecond precision
- Check that `date +%s%3N` works on your system

### Log file not created
- Check permissions on $TETRA_DIR/logs or /tmp/logs
- Run: `mkdir -p /tmp/logs && chmod 777 /tmp/logs`

### Colors don't show
- Terminal may not support ANSI colors
- Edit action_executor.sh to disable colors

## Success Criteria

After testing, you should see:

- ✅ Execution banners for all actions
- ✅ Timing information (in milliseconds)
- ✅ Logs in tetra.jsonl (try/success pairs)
- ✅ Footer updates with completion info
- ✅ Action signatures show () → @targets
- ✅ State symbols update correctly
- ✅ Execution log view works (press 'l')

## Comparison to TES Spec

This implementation follows TES Section 5 (Action System):

| TES Requirement | Implementation | Demo |
|----------------|----------------|------|
| Action Template | action_registry.sh | ✅ |
| Fully Qualified Action | ACTION_show_demo | ✅ |
| Action Signature | build_action_signature() | ✅ |
| Execution Lifecycle | execute_action_with_feedback() | ✅ |
| Unified Logging | tetra_log() | ✅ |
| Output Routing | route_output() | ✅ |
| Validation | validate_action() | ✅ |

## Next Steps

Once this is working, you can:

1. Add real deployment actions (deploy:staging)
2. Integrate with NodeHolder servers
3. Add actions with inputs (rekey:local_to_dev)
4. Implement remote execution
5. Add action chaining/composition

The foundation is now solid and TES-compliant!
