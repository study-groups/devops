# Vox Interactive REPL

## Overview

The vox REPL provides an interactive command-line interface for working with the vox audio system. It follows the tsm REPL pattern with slash commands, history tracking, and bash integration.

## Starting the REPL

```bash
cd /Users/mricos/src/devops/tetra/bash/vox
source vox.sh
vox repl
```

## Command Categories

### Slash Commands (System)

Slash commands control the REPL itself:

```bash
/help           # Show help
/?              # Show help (alias)
/exit           # Exit REPL
/quit           # Exit REPL (alias)
/history [n]    # Show last n commands (default: 20)
/last [n]       # Show last command output
/clear          # Clear screen
/voices         # List available voices
/voice <name>   # Set default voice
/cache          # Show cache statistics
/cost           # Show cost summary (future)
```

### TTS Commands

Generate and play text-to-speech:

```bash
# Play QA answers
a 0 sally               # Play latest QA with sally voice
a 5                     # Play qa:5 with default voice
play nova qa:0          # Play latest QA with nova voice

# Generate and save
gen sally qa:0 -o file.mp3

# Dry-run analysis (no API calls)
dry qa qa:0 alloy       # Analyze QA answer
dry batch sally 0 10    # Analyze 10 QA answers
dry stdin nova          # Analyze text from input
```

### Sound Commands

Generate programmatic sounds:

```bash
sound "bd sd cp hh"             # Play drum pattern
sound "bd ~ sd ~" -o beat.wav   # Save pattern to file
sound "c e g c"                 # Play musical notes
```

### QA Commands

Work with QA database:

```bash
qa ls              # List all QA answers
qa cat 5           # Show QA answer content
qa info 5          # Show QA metadata
```

### List Commands

View available sources:

```bash
ls                 # List all (QA + cache)
ls qa              # List QA answers only
ls cache           # Show cache statistics
```

### Bash Commands

Execute bash commands with `!` prefix:

```bash
!ls *.mp3          # List audio files
!pwd               # Show current directory
!df -h             # Show disk usage
!find . -name "*.mp3"  # Find audio files
```

### Text Input

Generate TTS from quoted text:

```bash
"Hello world!"                  # Generate with default voice
"This is a test"                # Generate and play
```

## Voice Management

### Set Default Voice

```bash
vox> /voice sally
Default voice set to: sally

vox> /voice
Current voice: sally
```

### List Available Voices

```bash
vox> /voices
Available Voices:
  alloy    - Neutral, balanced
  echo     - Clear, articulate
  fable    - Expressive, warm
  onyx     - Deep, authoritative
  nova     - Friendly, conversational
  shimmer  - Bright, energetic

Current: sally
```

## History

### Command History

```bash
vox> /history 10
Vox Command History (last 10 commands):
  1: a 0 sally
  2: dry qa qa:0 nova
  3: ls qa
  4: /voices
  ...
```

### Output History

```bash
vox> /last
==== ENTRY 2024-10-12 21:00:00 ====
COMMAND: a 0 sally
OUTPUT:
Playing qa:0 with sally...
[Audio output details]

vox> /last 1
==== ENTRY 2024-10-12 20:59:30 ====
COMMAND: dry qa qa:0 nova
OUTPUT:
[Dry-run analysis results]
```

## Example Sessions

### Session 1: Exploring QA Answers

```bash
vox> ls qa
Available QA Sources:
qa:0   qa:1760229927   7.7K   write a combined article...
qa:1   qa:1760229395   4.9K   Would you agree that...
...

vox> qa info 0
QA Answer: 1760229927
Path: /Users/mricos/tetra/qa/db/1760229927.answer
Size: 7839 bytes
Prompt: write a combined article of these two...

vox> dry qa qa:0 nova
===================================
Vox Dry-Run Analysis
===================================
...
Cache: HIT
Cost: $0.00 USD

vox> a 0 nova
🔊 Playing qa:0 with nova...
Playing cached audio (qa:0, nova)
```

### Session 2: Sound Synthesis

```bash
vox> sound "bd sd cp hh"
🎵 Generating sound...
[Plays drum pattern]

vox> sound "bd ~ sd ~"
🎵 Generating sound...
[Plays pattern with rests]

vox> sound "c e g c"
🎵 Generating sound...
[Plays musical arpeggio]
```

### Session 3: Batch Analysis

```bash
vox> /voice sally
Default voice set to: sally

vox> dry batch sally 0 5
===================================
Batch Dry-Run Analysis
===================================
Voice: sally
Range: qa:0 to qa:4

qa:0     [MISS]         37 chars  Test question?
qa:1     [MISS]       7839 chars  write a combined article...
qa:2     [HIT]        4961 chars  Would you agree that...
qa:3     [MISS]       4706 chars  Describe arithetic operations...
qa:4     [MISS]       2046 chars  i want to connect to a tgam...

Summary:
  Total items:    5
  Cache hits:     1
  Cache misses:   4
  Total chars:    19589
  Est. cost:      $.2350 USD (for cache misses)
```

### Session 4: Text Generation

```bash
vox> /voice nova
Default voice set to: nova

vox> "Hello! This is a test of the vox system."
🔊 Generating TTS with nova...
[Generates and plays audio]

vox> "The quick brown fox jumps over the lazy dog."
🔊 Generating TTS with nova...
[Generates and plays audio]
```

### Session 5: Mixed Workflow

```bash
vox> ls qa
[Shows QA list]

vox> !pwd
/Users/mricos/src/devops/tetra/bash/vox

vox> dry qa qa:0 alloy
[Shows dry-run analysis]

vox> a 0 alloy
[Plays audio]

vox> /cache
=== Cache Statistics ===
Cache Statistics:
  Location: /Users/mricos/tetra/vox/cache
  Files: 42
  Size: 15.8 MB
...

vox> /history
[Shows command history]

vox> /exit
👋 Goodbye!
```

## Features

### ✅ Command History

- Persistent history saved to `$VOX_DIR/.vox_history`
- View history with `/history [n]`
- readline support (up/down arrows)

### ✅ Output Capture

- All command outputs saved to `$VOX_DIR/repl_history.log`
- Retrieve with `/last [n]`
- Includes timestamp and command

### ✅ Voice Persistence

- Set default voice with `/voice <name>`
- Persists for session (via `VOX_DEFAULT_VOICE`)
- Used by `a` command when voice not specified

### ✅ Tab Completion

- Command completion (future)
- File path completion (future)
- QA ID completion (future)

### ✅ Graceful Exit

- Ctrl-C exits cleanly
- `/exit` or `/quit` commands
- Auto-save history on exit

## File Locations

```
$VOX_DIR/
├── .vox_history          # Command history
├── repl_history.log      # Output history
└── cache/                # Audio cache
```

## Comparison with tsm REPL

Vox REPL follows the same patterns as tsm REPL:

| Feature | tsm REPL | vox REPL |
|---------|----------|----------|
| Slash commands | ✅ | ✅ |
| Bash integration (!cmd) | ✅ | ✅ |
| Command history | ✅ | ✅ |
| Output history (/last) | ✅ | ✅ |
| Help system | ✅ | ✅ |
| Graceful exit | ✅ | ✅ |

## Tips

1. **Set your preferred voice at the start:**
   ```bash
   vox> /voice nova
   ```

2. **Use dry-run before expensive operations:**
   ```bash
   vox> dry batch sally 0 20
   # Check cost before proceeding
   ```

3. **Combine with bash commands:**
   ```bash
   vox> !ls *.mp3
   vox> !find . -name "*.mp3" | wc -l
   ```

4. **Check cache before generating:**
   ```bash
   vox> /cache
   vox> dry qa qa:5 nova    # Check if cached
   vox> a 5 nova            # Generate if needed
   ```

5. **Use /last to review results:**
   ```bash
   vox> dry batch sally 0 10
   vox> /last               # Review full output
   ```

## Future Enhancements

### Planned Features

- **Tab completion** for commands and QA IDs
- **Async playback** (continue working while audio plays)
- **Playlist mode** (queue multiple QA answers)
- **Cost tracking** (session cost summary)
- **Export session** (save commands and outputs)
- **Macro support** (record command sequences)
- **Config persistence** (save voice preference)

### Possible Additions

- **Voice comparison** (play same content with different voices)
- **Bookmark system** (save favorite QA references)
- **Search integration** (search QA answers inline)
- **Audio control** (pause, resume, stop during playback)
- **TUI mode** (switch to visual interface)

## Troubleshooting

### REPL doesn't start

```bash
# Make sure vox is sourced
source vox.sh

# Try direct call
vox_repl_main
```

### Commands not found

```bash
# Verify all modules loaded
ls -la vox_*.sh

# Re-source vox
source vox.sh
vox repl
```

### History not saving

```bash
# Check VOX_DIR exists
echo $VOX_DIR

# Create manually if needed
mkdir -p $VOX_DIR
```

### Audio not playing

```bash
# Check player availability
vox> !which afplay  # macOS
vox> !which mpg123  # Linux

# Test directly
vox> !afplay test.mp3
```

## Integration with Workflows

### With QA System

```bash
# In one terminal: QA queries
qa query "How does caching work?"

# In vox REPL: Play answers
vox> a 0 nova
vox> dry qa qa:0 alloy
```

### With Scripts

```bash
# Generate batch script
for i in {0..10}; do
  echo "a $i sally"
done | vox repl
```

### With TUI (Future)

```bash
vox> /tview         # Switch to TUI mode
# Visual interface with section navigation
```

## License

Part of the tetra framework - MIT License
