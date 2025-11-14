# MIDI Metronome & Musical Cron

## Overview
A metronome/MIDI clock generator with a musical cron scheduler for time-based MIDI automation.

## Features

### 1. MIDI Clock Generator
- Send MIDI Clock messages (24 PPQN - pulses per quarter note)
- Configurable BPM (30-300)
- Start/Stop/Continue transport control
- Song Position Pointer support

### 2. Metronome Output
- Audible/visual click on beats
- Configurable note/velocity for downbeat and subdivision
- Patterns: 1/4, 1/8, 1/16, triplets
- Accent patterns (e.g., 4/4 time: STRONG-weak-medium-weak)

### 3. Musical Cron Scheduler
User-defined jobs that trigger on musical time boundaries:

**Time Units:**
- `beat` - every beat (quarter note)
- `bar` - every bar/measure
- `phrase` - every N bars (e.g., 4, 8, 16 bars)
- `beat.2` - on beat 2 of each bar
- `bar.4` - every 4 bars
- `tick` - every MIDI clock tick (1/24 of a beat)

**Job Format:**
```bash
# Musical cron syntax: <when> <action> [args...]
beat.1 send note 40 127    # On beat 1, send note on
beat.3 send note 40 0      # On beat 3, send note off
bar.4  load-map synth      # Every 4 bars, switch map
phrase script /path/to/script.sh  # Every phrase, run script
```

### 4. Commands

#### CLI Mode
```bash
metro start [bpm]      # Start metronome (default 120 BPM)
metro stop             # Stop metronome
metro bpm <value>      # Set BPM (30-300)
metro tap              # Tap tempo (4 taps to set)
metro pattern <type>   # Set pattern: 1/4, 1/8, 1/16, triplet
metro accent <pattern> # Set accent pattern (e.g., "Xoo" = strong-weak-weak)

# Cron scheduler
cron add <spec>        # Add cron job
cron list              # List active jobs
cron remove <id>       # Remove job by ID
cron clear             # Clear all jobs
cron enable            # Enable scheduler
cron disable           # Disable scheduler
```

#### Key Mode
```
m        Toggle metro on/off
+/-      Adjust BPM ±5
t        Tap tempo mode
```

## Implementation

### Architecture
```
┌─────────────────────────────────────────────┐
│ MIDI Service (midi.js)                      │
│ ┌─────────────────────────────────────────┐ │
│ │ MetronomeEngine                         │ │
│ │ - setInterval() for clock timing        │ │
│ │ - Sends MIDI Clock (0xF8) @ 24 PPQN     │ │
│ │ - Sends Start (0xFA), Stop (0xFC)       │ │
│ │ - Tracks beat/bar/phrase counters       │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ MusicalCron                             │ │
│ │ - Evaluates jobs on each beat/bar       │ │
│ │ - Executes actions via OSC or direct    │ │
│ │ - Persists job list to file             │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ OSC Broadcasts:                             │
│ /midi/metro/beat {beat} {bar} {tick}       │
│ /midi/metro/bpm {bpm}                      │
│ /midi/metro/state {running|stopped}        │
└─────────────────────────────────────────────┘
         ↓ OSC
┌─────────────────────────────────────────────┐
│ REPL                                        │
│ - Shows metro state in status display      │
│ - Manages cron jobs                        │
│ - Tap tempo UI                             │
└─────────────────────────────────────────────┘
```

### MIDI Clock Timing
```javascript
// BPM to clock interval (milliseconds per tick)
// 24 ticks per quarter note
function bpmToInterval(bpm) {
    const msPerBeat = 60000 / bpm;
    return msPerBeat / 24;  // 24 PPQN
}

// Example: 120 BPM
// 60000 / 120 = 500 ms per beat
// 500 / 24 = 20.83 ms per tick
```

### Musical Cron State
```javascript
{
    beat: 1,        // Current beat in bar (1-based)
    bar: 1,         // Current bar number
    tick: 0,        // Current tick (0-23)
    phrase: 1,      // Current phrase (every N bars)
    phraseLen: 4,   // Phrase length in bars
    timeSig: [4,4], // Time signature [beats, division]
    jobs: [
        { id: 1, when: "beat.1", action: "send", args: ["note", "40", "127"] },
        { id: 2, when: "bar.4", action: "load-map", args: ["synth"] }
    ]
}
```

### Files
- `midi.js` - Add MetronomeEngine and MusicalCron classes
- `core/repl.sh` - Add metro/cron commands
- `$MIDI_DIR/cron_jobs.json` - Persisted cron jobs

## Use Cases

### 1. Simple Metronome
```bash
metro start 140
metro accent "Xooo"  # 4/4 with strong downbeat
```

### 2. Auto-Pattern Switcher
```bash
cron add "bar.8 load-map drums_fill"
cron add "bar.16 load-map drums_basic"
```

### 3. Live Performance Automation
```bash
cron add "phrase.4 send cc 7 127"     # Volume up every 4 phrases
cron add "beat.1 send note 36 127"    # Kick on 1
cron add "beat.3 send note 38 100"    # Snare on 3
```

### 4. Generative Music
```bash
cron add "bar.1 script /path/to/random_notes.sh"
```

## Configuration
Add to `config.toml`:
```toml
[metronome]
default_bpm = 120
default_pattern = "1/4"
default_accent = "Xooo"
send_clock = true          # Send MIDI Clock messages
send_clicks = false        # Send audible click notes

[metronome.click]
downbeat_note = 76         # High wood block
downbeat_velocity = 127
subdivision_note = 77      # Low wood block
subdivision_velocity = 80

[cron]
enabled = true
phrase_length = 4          # Bars per phrase
persist_file = "~/tetra/midi/cron_jobs.json"
```

## Next Steps
1. Implement MetronomeEngine class in midi.js
2. Implement MusicalCron scheduler
3. Add REPL commands (metro, cron)
4. Add OSC control messages
5. Add status display for metro state
6. Add tap tempo UI
7. Add persistence for cron jobs
