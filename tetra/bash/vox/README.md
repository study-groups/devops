# vox - Audio-Text Synchronization System

**Pure pipe-first TTS + programmatic sound generation for the tetra framework**

**Version:** 1.0.0
**TCS Version:** 3.0 Compliant
**Status:** Production Ready

---

## Related Documentation
- [Tetra Core Specification](../../docs/Tetra_Core_Specification.md) - Foundational concepts (TCS 3.0)
- [Module Convention](../../docs/Tetra_Module_Convention.md) - Module integration patterns
- [TES Storage Extension](../../docs/TES_Storage_Extension.md) - Cloud storage for audio files

---

## Overview

vox is a TCS 3.0-compliant dual-purpose audio system:
1. **TTS (Text-to-Speech)** - OpenAI-powered voice synthesis with pipe-first design
2. **Sound Synthesis** - Strudel-inspired programmatic sound generation with custom wave synthesis

**Key Features:**
- ✅ Pipe-first Unix design (`cat file | vox generate sally`)
- ✅ Custom wave synthesis (no SoX, no Python - pure bash/awk + Go)
- ✅ Strudel-like mini-notation for rhythmic patterns
- ✅ Zero legacy code - clean, tight implementation
- ✅ **TCS 3.0 Compliant** - Database pattern, symbol resolution, type contracts
- ✅ **Cross-module integration** - Preserves QA timestamps for correlation

---

## TCS 3.0 Compliance

### Module Database Pattern

VOX follows the TCS 3.0 database pattern:

**Directory Structure**:
```
$TETRA_DIR/vox/
├── db/                   # TCS 3.0 Database (timestamp-based)
│   ├── {ts}.vox.{voice}.mp3   # Audio files
│   ├── {ts}.vox.{voice}.meta  # Metadata
│   └── {ts}.vox.{voice}.spans # Timing data (planned)
├── config/               # Configuration
├── logs/                 # Module-specific logs
└── cache/                # Optional caching
```

**Primary Key**: Unix timestamp (1-second resolution)
**Filename Format**: `{timestamp}.vox.{voice}.{extension}`
**Guarantee**: No collisions - operations never start faster than 1-second intervals

### Path Functions

All TCS 3.0 path functions implemented in `vox_paths.sh`:

```bash
vox_get_db_dir()           # Returns $VOX_DIR/db
vox_generate_timestamp()   # Returns current Unix timestamp
vox_get_db_audio_path()    # Constructs timestamped audio path
vox_get_db_meta_path()     # Constructs timestamped metadata path
```

### Symbol Resolution

VOX provides `@vox:timestamp.voice` symbol resolution:

```bash
# Symbol examples
@vox:1760229927.sally      # Specific timestamp + voice
@vox:0                     # Latest (relative index)
@vox:*.mp3                 # Wildcard (for sync operations)

# Resolution: @vox:1760229927.sally → $VOX_DIR/db/1760229927.vox.sally.mp3
```

### Type Contracts

Every VOX action declares its type contract using the `::` operator:

```bash
vox.play :: (text:stdin, voice:string) → Audio[stdout]
  where Effect[api_call, cache, log, metadata]

vox.generate :: (voice:string, text:stdin) → @vox:timestamp.voice.mp3
  where Effect[api_call, cache, log, metadata]

vox.list :: ([filter:string]) → Text[stdout]
  where Effect[read]

vox.sync :: (@vox:*.mp3 → @spaces:vox-audio/*.mp3)
  where Effect[network, write, log]
```

### Cross-Module Integration

VOX preserves timestamps from other modules (e.g., QA):

```bash
# QA generates answer
qa.query "What is bash?"
# → Creates: $QA_DIR/db/1760229927.answer

# VOX processes QA answer (preserves timestamp!)
qa a 0 | vox play sally
# → Creates: $VOX_DIR/db/1760229927.vox.sally.mp3
#            (same timestamp = 1760229927)

# Find all resources for this query
find $TETRA_DIR -name "1760229927.*"
# ~/tetra/qa/db/1760229927.answer
# ~/tetra/vox/db/1760229927.vox.sally.mp3
# ~/tetra/vox/db/1760229927.vox.sally.meta
```

## Quick Start

### TTS (Text-to-Speech)
```bash
# Simple text to speech
echo "Hello world" | vox play alloy

# Generate audio file
cat story.txt | vox generate nova --output story.mp3

# Dry-run analysis (no API calls)
echo "Test text" | vox dry-run stdin sally

# Available voices: alloy, echo, fable, onyx, nova, shimmer
```

### Sound Generation
```bash
# Generate drum pattern
echo "bd sd cp hh" | vox sound generate --output beat.wav

# Play pattern directly
echo "bd ~ sd ~" | vox sound play --tempo 140

# Musical tones
echo "c a f e" | vox sound generate --synth sine --tempo 120
```

## Architecture

### Core Modules

```
bash/vox/
├── vox.sh                     # Main CLI (pipe-first)
├── vox_core.sh               # TTS generation (OpenAI)
├── vox_cache.sh              # Content-addressed caching
├── vox_qa.sh                 # QA database integration
├── vox_dry_run.sh            # Dry-run analysis (no API calls)
├── vox_sound.sh              # Sound generation integration
├── vox_sound_synth.sh        # Custom wave synthesis
├── vox_sound_pattern.sh      # Mini-notation parser
├── wav_encode.go             # Pure Go WAV encoder (2.1MB binary)
└── wav_encode                # Compiled binary
```

### Tech Stack
- **Bash 5.2** - Control flow and integration
- **AWK** - High-performance math (sine waves, exponentials, random)
- **Go** - WAV encoding (single static binary, no runtime deps)
- **BC** - High-precision calculations
- **curl + jq** - OpenAI API integration

**Zero Python dependencies!**

## TTS (Text-to-Speech)

### Configuration

Set your OpenAI API key:
```bash
export OPENAI_API_KEY='sk-...'
# Or save to file:
mkdir -p ~/.config/vox
echo 'sk-...' > ~/.config/vox/openai_key
```

### Usage

**Pipe-first design:**
```bash
# From stdin
echo "Test message" | vox play alloy

# From file
cat chapter.txt | vox generate nova --output chapter.mp3

# Direct file (shortcut)
vox generate sally story.txt --output story.mp3
```

**Available OpenAI voices:**
- `alloy` - Neutral, balanced
- `echo` - Clear, articulate
- `fable` - Expressive, warm
- `onyx` - Deep, authoritative
- `nova` - Friendly, conversational
- `shimmer` - Bright, energetic

### Limitations
- OpenAI TTS has 4096 character limit (auto-truncates with warning)
- MP3 output only (OpenAI API constraint)

### Dry-Run Analysis

Test inputs and estimate costs without making API calls:

```bash
# Analyze stdin
echo "Your text" | vox dry-run stdin sally

# Analyze QA reference
vox dry-run qa qa:0 nova

# Analyze file
vox dry-run file document.txt alloy

# Batch analysis
vox dry-run batch sally 0 10    # Analyze qa:0 through qa:9

# Get help
vox dry-run help
```

**What dry-run shows:**
- Content characteristics (chars, words, lines, hash)
- Cache status (HIT/MISS)
- Estimated API cost
- Truncation warnings
- Content preview

See [DRY_RUN.md](./DRY_RUN.md) for complete documentation.

## Sound Synthesis

### Custom Synthesizers

All pure math - no external dependencies:

**Drum Sounds:**
- `bd`, `kick` - Bass drum (pitch envelope 150→40Hz)
- `sd`, `snare` - Snare (tone + noise blend)
- `cp`, `clap` - Clap (multi-burst filtered noise)
- `hh`, `hihat` - Hi-hat (high-frequency burst)

**Waveforms:**
- `sine` - Pure sine wave
- `square` - Square wave
- `saw` - Sawtooth wave
- `triangle` - Triangle wave
- `noise` - White noise

### Pattern Notation

Strudel/TidalCycles-inspired mini-notation:

```bash
# Simple sequence (space-separated)
echo "bd sd cp hh" | vox sound play

# Rests with ~
echo "bd ~ sd ~" | vox sound play --tempo 140

# Musical notes (c d e f g a b)
echo "c e g c" | vox sound generate --synth sine

# Mix drums and notes
echo "bd sd hh hh" | vox sound play --tempo 160
```

### Options

```bash
--output, -o FILE     # Output WAV file
--tempo, -t BPM       # Beats per minute (default: 120)
--synth, -s TYPE      # Synth type (auto, sine, square, saw, triangle)
```

## Implementation Details

### Wave Synthesis (vox_sound_synth.sh)

Pure mathematical synthesis using AWK:

```awk
# Example: Kick drum with pitch envelope
for (i = 0; i < samples; i++) {
    t = i / rate
    freq = 40 + 110 * exp(-t * 8)      # 150Hz → 40Hz decay
    amp = exp(-t * 6)                   # Exponential amplitude decay
    value = amp * sin(2 * pi * freq * t)
    print value
}
```

**Performance:**
- Generates 44.1kHz samples in real-time
- AWK handles math operations efficiently
- Go encoder converts samples to WAV instantly

### WAV Encoding (wav_encode.go)

Pure Go binary with zero runtime dependencies:

```bash
# Build
go build -o wav_encode wav_encode.go

# Usage (from bash)
synth_kick 0.5 | ./wav_encode 44100 1 > kick.wav
```

**Features:**
- Reads float samples from stdin
- Writes RIFF WAV to stdout
- 16-bit PCM encoding
- Configurable sample rate and channels
- 2.1MB static binary

### Pattern Parser (vox_sound_pattern.sh)

Parses mini-notation into timeline events:

```bash
# Input pattern
"bd sd cp hh"

# Output timeline (time, sound, duration)
0.000000 bd 0.125000
0.125000 sd 0.125000
0.250000 cp 0.125000
0.375000 hh 0.125000
```

## File Structure

```
project/
├── story.txt                 # Source text
├── story.mp3                # Generated TTS audio
├── beat.wav                 # Generated sound pattern
└── .vox/                    # Future: config and cache
    ├── config.toml          # Project configuration
    └── cache/               # Audio cache
```

## Environment Variables

```bash
VOX_SRC       # Module source directory (auto-detected)
VOX_DIR       # Data directory (default: $TETRA_DIR/vox)
OPENAI_API_KEY # OpenAI API key for TTS
```

## Examples

### Audiobook Generation
```bash
for chapter in chapters/*.txt; do
    base=$(basename "$chapter" .txt)
    cat "$chapter" | vox generate nova --output "audio/$base.mp3"
done
```

### Rhythmic Patterns
```bash
# Four-on-the-floor
echo "bd bd bd bd" | vox sound play --tempo 128

# Classic 808 pattern
echo "bd ~ sd ~ bd ~ sd ~" | vox sound play --tempo 120

# Hi-hat pattern
echo "hh hh hh hh" | vox sound play --tempo 140
```

### Musical Sequences
```bash
# C major scale
echo "c d e f g a b c" | vox sound generate --synth sine --tempo 120

# Arpeggio
echo "c e g c" | vox sound play --synth triangle --tempo 100
```

## Future Roadmap

### Phase 1 (Complete)
- ✅ Pipe-first TTS
- ✅ Custom wave synthesis
- ✅ Mini-notation parser
- ✅ Go WAV encoder

### Phase 2 (Next)
- esto markup language (`@directives`, IPA phonetics)
- Hierarchical span system (audio-text sync)
- Layered configuration system
- Proper audio mixing (overlapping sounds)

### Phase 3 (Future)
- Euclidean rhythms: `bd(3,8)`
- Pattern functions: `fast()`, `slow()`, `rev()`
- REPL for live coding
- TUI demo with synchronized playback
- Markdown + LaTeX math support
- Multi-voice narration

## Dependencies

**Required:**
- bash 5.2+
- awk (gawk or BSD awk)
- bc (basic calculator)
- curl (for OpenAI API)
- jq (JSON processing)
- Go 1.16+ (to build WAV encoder)

**Audio playback (one of):**
- afplay (macOS)
- mpg123 (Linux)
- mpv (cross-platform)
- ffplay (ffmpeg)

## Building

```bash
cd $TETRA_SRC/bash/vox

# Compile WAV encoder
go build -o wav_encode wav_encode.go

# Test TTS
echo "Hello" | vox play alloy

# Test sound
echo "bd sd cp hh" | vox sound play
```

## Design Philosophy

**Pipe-First:**
- Everything works with stdin/stdout
- Composable with other Unix tools
- No module coupling

**Pure Implementation:**
- Custom wave synthesis (no SoX)
- Go WAV encoder (no Python)
- Minimal dependencies

**Clean Code:**
- No legacy QA integration
- Tight, focused modules
- Easy to understand and extend

## Credits

**Inspired by:**
- [Strudel](https://strudel.cc/) - Live coding pattern language
- [TidalCycles](https://tidalcycles.org/) - Algorithmic pattern music
- Unix philosophy - Pipe-first composability

**Built for:**
- [tetra](https://github.com/tetraframework) - Modular bash framework

## License

MIT License - See tetra framework for details
