# MIDI Dual-Mode REPL - Usage Guide

## Quick Start

```bash
# Start the MIDI service (if not already running)
midi start

# Launch the new dual-mode REPL
midi repl2
```

## Two Modes of Operation

### CLI Mode (Default)

**Standard command-line interface** with full readline features:

- Type commands and press Enter
- Arrow keys for history
- Tab completion (coming soon)
- Full bash line editing (Ctrl+A, Ctrl+E, etc.)

**CLI Commands:**
```
help              Show help
status            Show MIDI status
log [mode]        Set/toggle log mode (off/raw/semantic/both)
variant <a-d>     Switch to variant a, b, c, or d
load-map <name>   Load a MIDI map file
reload            Reload current map
reload-config     Reload config.toml
devices           List available MIDI devices
exit, quit, q     Exit REPL
```

**Examples:**
```
> help
> variant b
> load-map vmx8[0]
> log semantic
> status
```

### Key-Command Mode

**Single-keystroke instant actions** - no Enter key needed:

**How to Enter:**
- Type `/key` and press Enter
- The prompt will show `[KEY]` indicator

**Key Bindings:**
```
a, b, c, d    Switch variant (instant)
l             Toggle log mode (cycles through off/raw/semantic/both)
s             Show status
h, ?          Show help
q, Ctrl+D     Quit
ESC           Return to CLI mode
```

**No typing** - just press the key and the action happens immediately!

## Mode Switching

```
┌─────────────┐
│  CLI Mode   │ ◄─── Start here (default)
│  (commands) │
└─────┬───────┘
      │
      │ Type /key and press Enter
      │
      ↓
┌─────────────┐
│  Key Mode   │ ◄─── Shows [KEY] in prompt
│  (instant)  │
└─────┬───────┘
      │
      │ Press <ESC>
      │
      ↓
┌─────────────┐
│  CLI Mode   │
└─────────────┘
```

## Visual Indicators

### CLI Mode Prompt
```
[no-device] [--] [log:off] 239.1.1.1:1983 >
                                          ^ Normal prompt
```

### Key Mode Prompt
```
[no-device] [--] [log:off] 239.1.1.1:1983 [KEY] >
                                          ^^^^^ Mode indicator
```

### Prompt Components

```
[controller:variant] [CC#=value] [log:mode] host:port [KEY] >
 ^^^^^^^^^^^^^^^^^^^  ^^^^^^^^^^^  ^^^^^^^^^  ^^^^^^^^^  ^^^^
 Device & variant     Last CC      Log mode   OSC addr   Mode
```

**Color Coding:**
- **Green**: Low CC values (0-42)
- **Yellow**: Mid CC values (43-84)
- **Red**: High CC values (85-127)

## Usage Patterns

### Quick Variant Switching

**In CLI Mode:**
```
> variant a
> variant b
```

**In Key Mode (faster):**
```
> /key     # Enter key mode
a          # Switch to variant A (instant)
b          # Switch to variant B (instant)
<ESC>      # Back to CLI
```

### Loading Maps and Debugging

**Use CLI mode for complex operations:**
```
> load-map vmx8[0]
Loading map: vmx8[0]

> log semantic
Log mode: semantic

> status
═══ MIDI Status ═══
Controller: vmx8
Variant: a (Bass)
Log Mode: semantic
OSC: 239.1.1.1:1983
Mode: cli
```

### Live Performance Workflow

1. Start in **CLI mode**, load your map:
   ```
   > load-map my-performance[0]
   > variant a
   ```

2. Switch to **Key mode** for live control:
   ```
   > /key     # Enter key mode
   ```

3. During performance, use single keys:
   ```
   b          # Switch to variant B (bridge section)
   c          # Switch to variant C (chorus)
   d          # Switch to variant D (outro)
   l          # Toggle event logging
   ```

4. Return to **CLI mode** for map changes:
   ```
   <ESC>      # Back to CLI
   > load-map different-song[0]
   ```

## Log Modes

Control what events are displayed:

- **off**: No event logging (clean display)
- **raw**: Show raw MIDI CC events
- **semantic**: Show mapped control values only
- **both**: Show all events

**Toggle through modes:**
- CLI: `log` or `log <mode>`
- Key: Press `l`

## Tips & Tricks

### 1. Start Clean, Switch When Needed
- Default CLI mode is great for setup and configuration
- Switch to key mode only when you need speed
- Best of both worlds!

### 2. History is Your Friend (CLI Mode)
- Up/Down arrows recall previous commands
- Ctrl+R for reverse history search
- Commands are saved across sessions

### 3. Key Mode for Live Control
- No accidental typos during performance
- Instant response (no Enter key lag)
- Visual feedback for each action

### 4. ESC is Your Safety Net
- Accidentally in key mode? Press ESC
- Always know your mode by the prompt

### 5. Explicit Mode Command
- Type `/key` to enter key mode (explicit and clear)
- No accidental mode switches
- Easy to remember: "slash commands" like Slack/Discord

## Keyboard Shortcuts

### CLI Mode
```
Enter         Execute command
Tab           Tab completion (commands, variants, maps)
↑ / ↓         Navigate history
Ctrl+C        Cancel input / Exit
Ctrl+D        Exit REPL
Ctrl+A        Start of line
Ctrl+E        End of line
Ctrl+L        Clear screen
Ctrl+R        Reverse history search
/key          Enter key mode
```

### Key Mode
```
a-d           Variant switch
l             Toggle log
s             Status
h/?           Help
q/Ctrl+D      Quit
ESC           Return to CLI mode
Ctrl+C        Exit
```

## Troubleshooting

### "Command not found" in Key Mode
- You're in key mode! Keys are single actions, not commands
- Press ESC to return to CLI mode
- Look for `[KEY]` in the prompt

### Prompt looks weird
- Make sure your terminal supports ANSI colors
- Try: `export TERM=xterm-256color`

### Keys not responding
- Check if you're in CLI mode (default)
- Press `<space>` to enter key mode
- Terminal must support raw input mode

### Can't exit key mode
- Press ESC
- If stuck, press Ctrl+C to exit entirely

## Migration from Old REPL

The new dual-mode REPL is **fully backwards compatible**:

**Old TUI mode:**
```bash
midi repl        # Still works! (original pure-TUI mode)
```

**New dual mode:**
```bash
midi repl2       # New dual-mode version
```

**Key differences:**
- Old: Pure TUI (always key mode)
- New: Starts in CLI, switch to key mode on demand

**When ready, the new version will become `midi repl`**

## Next Steps

1. Try it out: `midi repl2`
2. Use CLI mode for setup
3. Press `<space>` to try key mode
4. Press `ESC` to return
5. Type `help` for command reference

**Have fun!** 🎹🎵
