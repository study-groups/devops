# vox: Next Steps & Roadmap

## Current Status (Phase 1 Complete)

✅ **Implemented:**
- Pipe-first TTS with OpenAI (`echo "text" | vox play alloy`)
- Custom wave synthesis (bash/awk + Go WAV encoder)
- Strudel-inspired mini-notation parser
- Basic pattern playback (`echo "bd sd cp hh" | vox sound play`)
- Pure implementation (no SoX, no Python)

## Phase 2: Audio-Text Synchronization (Next Priority)

### 2.1 esto Markup Language
Implement clean `@directive` syntax for TTS control:

**Priority 1 - Basic esto Parser:**
```bash
# vox_esto.sh implementation
vox_esto_parse()      # Parse esto → plain text + metadata
vox_esto_validate()   # Lint esto syntax
```

**esto syntax to support:**
```
@title "Story Title"
@voice sally

@begin chapter name=intro
  Plain text content here.
@end chapter
```

**Defer for later:**
- IPA phonetics (word`phonetic`)
- Multi-voice casting
- Complex prosody control

### 2.2 Hierarchical Span System
Build offset-based text segments with audio timing:

**Priority 1 - Basic Spans:**
```bash
# vox_span.sh implementation
vox_span_create()     # Create span from offsets
vox_span_list()       # List all spans
vox_span_get()        # Get span by ID
vox_span_extract()    # Extract text via offsets
```

**Span file format (.vox.voice.spans):**
```json
{
  "source_file": "/path/to/file.esto",
  "audio_file": "/path/to/file.vox.sally.mp3",
  "voice": "sally",
  "audio_duration": 45.3,

  "spans": {
    "doc": {
      "type": "document",
      "text": "Full document text...",
      "start_offset": 0,
      "end_offset": 1234,
      "start_time": 0.0,
      "end_time": 45.3
    },
    "doc.c[0]": {
      "type": "chapter",
      "name": "intro",
      "text": "Chapter text...",
      "start_offset": 0,
      "end_offset": 500,
      "start_time": 0.0,
      "end_time": 20.0
    }
  }
}
```

**Defer for later:**
- Named + fuzzy addressing (`doc.c[prologue].s[dark]`)
- Hierarchical navigation (parent, children, siblings)
- Word/phoneme-level spans

### 2.3 Configuration System
Layered config with clean priority:

**Priority 1 - Basic Config:**
```bash
# vox_config.sh implementation
vox_config_load()     # Load config files
vox_config_get()      # Get config value
vox_config_merge()    # Merge layers
```

**Config layers (highest to lowest):**
1. CLI flags: `--voice marcus`
2. Project config: `.vox/config.toml`
3. User config: `~/.config/vox/config.toml`
4. System defaults

**Defer for later:**
- esto file directives override
- Per-span overrides (.vox/overrides.toml)
- Cast system (role-based voice mapping)

### 2.4 Audio Mixing
Proper mixing for sound patterns:

**Current limitation:**
- Only uses first sample (no overlap)

**Priority 1 - Basic Mixing:**
```bash
# vox_sound_mix.sh implementation
mix_samples()         # Mix overlapping audio samples
```

**Defer for later:**
- Effects chain (reverb, delay, filter)
- Multi-track export
- Volume normalization

## Phase 3: Pattern Language Enhancement

### 3.1 Euclidean Rhythms
Implement Bjorklund algorithm:

```bash
# Pattern: bd(3,8) - 3 kicks distributed over 8 steps
echo "bd(3,8) sd(5,8)" | vox sound play
# Output: bd ~ ~ bd ~ sd ~ bd sd ~ ~ sd ~ ~ sd ~
```

### 3.2 Pattern Functions
Add Strudel-like transformations:

```bash
# Speed modifiers
echo "bd sd" | vox sound play --fast 2    # *2 speed
echo "bd sd" | vox sound play --slow 2    # /2 speed

# Reverse
echo "bd sd cp hh" | vox sound play --rev

# Random probability
echo "bd? sd cp?" | vox sound play  # ? = 50% chance
```

### 3.3 Sub-sequences
Support `[]` for subdivision:

```bash
# [bd sd] plays twice as fast
echo "bd [sd cp] hh" | vox sound play
```

### 3.4 Alternation
Support `<>` for cycling patterns:

```bash
# Alternate between c and e each cycle
echo "<c e> g" | vox sound play
```

## Phase 4: REPL & Interactive Coding

### 4.1 Basic REPL
Interactive pattern shell:

```bash
vox repl

vox> play sally "Hello world"
[generates and plays]

vox> sound "bd sd cp hh" tempo 140
[generates and plays pattern]

vox> quit
```

### 4.2 Live Coding Features
Real-time pattern editing:

- Pattern hot-reload
- Tempo sync
- Pattern queuing (schedule changes on beat)

## Phase 5: Advanced Features (Future)

### 5.1 Markdown + Math Support
- Title detection with pause injection
- LaTeX math extraction
- AI-assisted math explanations (Claude/GPT)

### 5.2 Multi-Voice Narration
- Character voice mapping
- Dialogue detection
- Voice blending/crossfade

### 5.3 TUI Demo
- Synchronized text highlighting during playback
- Audio scrubbing by text position
- Visual waveform display

### 5.4 WebVTT Export
- Subtitle generation from spans
- Caption timing from audio sync
- Multi-language support

## Implementation Priority

**Phase 2 Order:**
1. Basic esto parser (plain text + @title, @voice)
2. Basic span system (sentence-level only)
3. Basic config loading (CLI + project config)
4. Audio mixing for sound patterns

**Success Criteria (Phase 2 MVP):**
```bash
# esto file with spans
cat story.esto | vox generate sally --spans --output story.mp3

# List generated spans
vox span list story.esto sally

# Play specific span
vox span play story.esto sally "doc.c[0]"

# Mixed sound pattern
echo "bd sd bd cp" | vox sound play --tempo 140
# (all 4 sounds play with proper timing/overlap)
```

## Design Constraints

**Keep it tight:**
- No XML/complex syntax in esto
- Offset-based (not line-based) for stability
- Sidecar files (.vox.voice.spans, .vox.voice.mp3)
- Pure pipes (no module coupling)

**Defer complexity:**
- Don't implement features we don't need yet
- Start with sentence-level spans (not word/phoneme)
- Simple config (defer overrides/cast system)
- Basic mixing (defer effects chain)

## File Structure (Target)

```
project/
├── chapter1.esto                # esto source
├── chapter1.vox.sally.mp3       # TTS audio
├── chapter1.vox.sally.spans     # span metadata (JSON)
├── chapter1.vox.sally.meta      # generation metadata
└── .vox/
    ├── config.toml              # project config
    └── cache/                   # temp files
```

## Module Additions Needed

```
bash/vox/
├── vox.sh                       # ✅ Main CLI
├── vox_core.sh                  # ✅ TTS generation
├── vox_sound.sh                 # ✅ Sound integration
├── vox_sound_synth.sh           # ✅ Wave synthesis
├── vox_sound_pattern.sh         # ✅ Pattern parser
├── wav_encode.go                # ✅ WAV encoder
├── vox_esto.sh                  # ⏳ esto parser (NEXT)
├── vox_span.sh                  # ⏳ span system (NEXT)
├── vox_config.sh                # ⏳ config loading (NEXT)
├── vox_sound_mix.sh             # ⏳ audio mixing (NEXT)
└── vox_repl.sh                  # ⬜ REPL (LATER)
```

## Testing Strategy

**Phase 2 Tests:**
```bash
# esto parsing
cat simple.esto | vox generate sally --spans --output test.mp3
vox span list simple.esto sally

# Config loading
echo "voice=nova" > .vox/config.toml
cat text.txt | vox generate  # Uses nova from config

# Sound mixing
echo "bd sd bd cp" | vox sound generate --output mixed.wav
# Verify: all sounds audible, proper timing
```

## Performance Targets

- **TTS generation:** < 3s for 1000 chars
- **Sound synthesis:** < 100ms for 4-bar pattern (16 steps)
- **Span parsing:** < 50ms for 10KB esto file
- **WAV encoding:** < 50ms for 1s audio @ 44.1kHz

## Open Questions

1. **Span timing precision:** Sentence-level sufficient, or need word-level for v1.0?
2. **Config format:** TOML vs JSON vs bash source? (Leaning TOML)
3. **Audio mixing:** Real-time mix or pre-render all samples?
4. **Pattern functions:** Implement in parser or separate transform step?

## Next Session Checklist

**Start with:**
1. Create `vox_esto.sh` with basic `@directive` parser
2. Create `vox_span.sh` with sentence-level span creation
3. Test: `cat simple.esto | vox generate sally --spans`

**Goal:** Working esto → spans → TTS pipeline by end of next session.
