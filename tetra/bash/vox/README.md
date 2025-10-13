# Vox - Text-to-Speech Module for Tetra

Vox is a TTS (Text-to-Speech) module that operates as an augmentation layer over the QA (Question & Answer) database. It provides voice synthesis with caching, grading, and comprehensive cost tracking.

## Architecture

### Core Concept
- Vox operates on **existing QA answer IDs** from `$QA_DIR/db/{id}.answer`
- Voice profiles use nginx-style available/enabled configuration
- Audio files are cached in QA database: `{qa_id}.vox.{voice}.mp3`
- Each voice+answer combo can be graded and compared
- Uses QA's OpenAI API key automatically

### Directory Structure

```
$TETRA_DIR/vox/
├── voice-available/        # All voice configurations (TOML files)
│   ├── sally.toml         # Female voice (OpenAI nova)
│   ├── marcus.toml        # Male voice (OpenAI onyx)
│   └── alex.toml          # Non-binary voice (OpenAI alloy)
├── voice-enabled/          # Enabled voices (symlinks)
│   └── sally.toml -> ../voice-available/sally.toml
├── voices/
│   └── active             # Current active voice ID
├── cache/
│   └── matrix.jsonl       # Voice matrix metadata
└── logs/
    └── usage.jsonl        # Cost tracking per generation

$TETRA_DIR/qa/db/           # Shared with QA module
├── {id}.answer            # QA answer text
├── {id}.vox.{voice}.mp3   # TTS audio (cached)
├── {id}.vox.{voice}.meta  # Generation metadata
└── {id}.vox.{voice}.grade # User rating
```

## Voice Configuration

### Voice Profile Format (TOML)

```toml
[voice]
id = "sally"
display_name = "Sally"
description = "Warm, friendly conversational voice"

[provider]
name = "openai"
model = "tts-1"
voice_id = "nova"
api_endpoint = "https://api.openai.com/v1/audio/speech"

[pricing]
cost_per_1m_chars = 15.00
currency = "USD"

[metadata]
tags = ["female", "warm", "friendly", "conversational"]
quality = "standard"
use_cases = ["podcasts", "audiobooks", "general"]
language = "en-US"
```

### Built-in Voices

| Voice ID | OpenAI Voice | Tags | Use Cases |
|----------|-------------|------|-----------|
| sally | nova | female, warm, friendly | Podcasts, audiobooks, general |
| marcus | onyx | male, deep, authoritative | Presentations, news, documentation |
| alex | alloy | non-binary, neutral, balanced | General, education, accessibility |

## Usage

### Basic Commands

```bash
# Vox last QA answer with active voice
vox a 1

# Vox with specific voice
vox a 1 marcus

# Vox specific QA ID
vox id 1728567890

# Vox arbitrary text
vox text "Hello world" sally

# Replay last audio
vox replay
```

### Voice Management

```bash
# List all voices
vox voices

# Set active voice
vox voice marcus

# Test a voice
vox voice-test sally

# Enable/disable voices
vox voice-enable alex
vox voice-disable alex

# Show voice info
vox voice-info marcus
```

### Voice Matrix & Caching

```bash
# Show voice matrix for a QA answer
vox matrix 1728567890

# Generate all voice variations
vox generate-matrix 1728567890

# Cache status
vox cache-status
```

### Grading & Comparison

```bash
# Grade a voice/answer combination
vox grade 1728567890 sally 5 "Perfect clarity and warmth"

# Show grades for an answer
vox grades 1728567890

# Play best-rated voice
vox best 1728567890
```

### Cost Analysis

```bash
# Total cost summary
vox cost-summary

# Cost by voice profile
vox cost-by-voice

# System status
vox status
```

### Interactive REPL

```bash
vox repl
```

REPL commands:
```
say> a 1                    # Vox last QA answer
say> a 1 marcus             # Vox with specific voice
say> qa What is AI?         # Ask QA and speak answer
say> voices                 # List voices
say> voice sally            # Switch voice
say> matrix 1728567890      # Show voice matrix
say> grade 1728567890 sally 5 "Great"
say> best 1728567890        # Play best-rated
say> help                   # Show help
```

## Integration with QA

Vox is tightly integrated with the QA module:

1. **Shared Database**: Audio files live in `$QA_DIR/db/` alongside QA data
2. **Same IDs**: Use QA answer IDs to reference audio
3. **Shared API Key**: Uses QA's OpenAI API key from `$QA_DIR/api_key`
4. **Syntax Compatibility**: `a 1` works like QA's answer command

### QA+Vox Workflow

```bash
# 1. Ask a question with QA
qa query "What is the fastest land animal?"

# 2. Vox the answer
vox a 1

# 3. Try different voices
vox a 1 marcus
vox a 1 sally

# 4. Grade the voices
vox grade <qa_id> marcus 4 "Clear but too formal"
vox grade <qa_id> sally 5 "Perfect warmth"

# 5. Play best
vox best <qa_id>

# 6. Or do it all in Vox REPL
vox repl
say> qa What is quantum computing?
say> grade <qa_id> sally 5 "Excellent"
```

## Cost Tracking

Vox provides granular cost tracking:

### Per-Request Logging (`logs/usage.jsonl`)
```json
{
  "timestamp": "2025-10-11T12:34:50Z",
  "qa_id": "1728567890",
  "voice": "sally",
  "chars": 150,
  "cost": 0.00225
}
```

### Metadata Files (`{id}.vox.{voice}.meta`)
```json
{
  "qa_id": "1728567890",
  "voice_profile": "sally",
  "provider": "openai",
  "model": "tts-1",
  "voice_name": "nova",
  "timestamp": "2025-10-11T12:34:50Z",
  "generation_seconds": 2,
  "text_length": 150,
  "audio_bytes": 245000,
  "cost_usd": 0.00225
}
```

### Grade Files (`{id}.vox.{voice}.grade`)
```json
{
  "qa_id": "1728567890",
  "voice": "sally",
  "rating": 5,
  "notes": "Perfect clarity and warmth",
  "timestamp": "2025-10-11T12:35:00Z",
  "graded_by": "username"
}
```

## Adding New Voices

### 1. Create Voice Config

Create `$TETRA_DIR/vox/voice-available/newvoice.toml`:

```toml
[voice]
id = "newvoice"
display_name = "New Voice"
description = "Description of voice characteristics"

[provider]
name = "openai"
model = "tts-1"
voice_id = "fable"  # OpenAI voice name

[pricing]
cost_per_1m_chars = 15.00
currency = "USD"

[metadata]
tags = ["tag1", "tag2"]
quality = "standard"
use_cases = ["use case 1", "use case 2"]
language = "en-US"
```

### 2. Enable the Voice

```bash
vox voice-enable newvoice
```

### 3. Test It

```bash
vox voice-test newvoice
```

## Shortcut Commands

```bash
s 1              # Shortcut for: vox a 1
sr               # Shortcut for: vox replay
```

## Dependencies

- **QA Module**: Required for database and API keys
- **jq**: JSON parsing
- **bc**: Cost calculations
- **curl**: API requests
- **afplay** (macOS) or **mpg123** or **mpv**: Audio playback

## API Key Configuration

Vox uses QA's OpenAI API key automatically from `$QA_DIR/api_key`.

If needed, you can set a separate key:
```bash
echo "sk-your-api-key" > $TETRA_DIR/vox/config/api_keys/openai
chmod 600 $TETRA_DIR/vox/config/api_keys/openai
```

## Examples

### Complete Workflow

```bash
# Initialize
vox init

# Ask QA a question
qa query "Explain quantum entanglement"

# Vox it with default voice
vox a 1

# Try all voices
vox generate-matrix $(qa last | grep -o '[0-9]*' | head -1)

# Listen to each one
vox id <qa_id> sally
vox id <qa_id> marcus
vox id <qa_id> alex

# Grade them
vox grade <qa_id> sally 5 "Warm and clear"
vox grade <qa_id> marcus 4 "Too formal"
vox grade <qa_id> alex 3 "Too neutral"

# Play the best
vox best <qa_id>

# Check costs
vox cost-summary
```

### Voice Comparison

```bash
# Create test phrase
vox text "The quick brown fox jumps over the lazy dog" sally
vox text "The quick brown fox jumps over the lazy dog" marcus
vox text "The quick brown fox jumps over the lazy dog" alex

# Compare costs
vox cost-by-voice
```

## Architecture Benefits

1. **Caching**: Never regenerate the same voice+answer combination
2. **Voice Matrix**: Compare multiple voices for the same content
3. **Grading System**: Track which voices work best for different content
4. **Cost Transparency**: Know exactly what each generation costs
5. **QA Integration**: Seamless workflow from question to answer to speech
6. **Extensible**: Easy to add new TTS providers and voices

## Future Enhancements

- Support for ElevenLabs API
- Support for Google Cloud TTS
- Voice cloning integration
- Batch generation workflows
- Export to podcast RSS
- Voice similarity comparison
- Audio post-processing (speed, pitch)
