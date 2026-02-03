#!/usr/bin/env bash

# vox_align.sh - Word-level alignment using faster-whisper
# Requires: pip install faster-whisper
# Returns: JSON array of word timings [{word, start, end}, ...]

# Default whisper model (tiny is fast, base/small for better accuracy)
VOX_ALIGN_MODEL="${VOX_ALIGN_MODEL:-tiny}"

# Check if faster-whisper is installed
vox_align_check() {
    tetra_python_activate >/dev/null 2>&1 || {
        echo "Error: tetra python environment not available" >&2
        return 1
    }

    if python -c "import faster_whisper" 2>/dev/null; then
        return 0
    else
        return 1
    fi
}

# Install faster-whisper
vox_align_install() {
    echo "Installing faster-whisper..."
    tetra_python_activate || {
        echo "Error: Failed to activate tetra python environment" >&2
        return 1
    }

    pip install faster-whisper
    local result=$?

    if [[ $result -eq 0 ]]; then
        echo "faster-whisper installed successfully"
        vox_align_status
    else
        echo "Error: Installation failed" >&2
        return 1
    fi
}

# Show align status
vox_align_status() {
    echo "Whisper Alignment Status"
    echo "========================"

    if ! tetra_python_activate >/dev/null 2>&1; then
        echo "Python: Not available (run tetra_python_activate)"
        return 1
    fi

    if vox_align_check; then
        echo "Installed: Yes"
        echo "Default model: $VOX_ALIGN_MODEL"
        echo ""
        echo "Available models (speed vs accuracy):"
        echo "  tiny   - Fastest, ~1GB VRAM, good for dev"
        echo "  base   - Fast, ~1GB VRAM, better accuracy"
        echo "  small  - Medium, ~2GB VRAM, good accuracy"
        echo "  medium - Slower, ~5GB VRAM, high accuracy"
        echo "  large  - Slowest, ~10GB VRAM, best accuracy"
    else
        echo "Installed: No"
        echo ""
        echo "Install with: vox align install"
    fi
}

# Align audio file, return word timings as JSON
# Usage: vox_align_file <audio_file> [model]
# Output: JSON array to stdout
vox_align_file() {
    local audio_file="$1"
    local model="${2:-$VOX_ALIGN_MODEL}"

    if [[ ! -f "$audio_file" ]]; then
        echo "Error: Audio file not found: $audio_file" >&2
        return 1
    fi

    tetra_python_activate >/dev/null 2>&1 || return 1

    if ! vox_align_check; then
        echo "Error: faster-whisper not installed" >&2
        echo "Install with: vox align install" >&2
        return 1
    fi

    python3 <<PYEOF
import sys
import json
from faster_whisper import WhisperModel

model = WhisperModel("$model", device="cpu", compute_type="int8")
segments, info = model.transcribe("$audio_file", word_timestamps=True)

words = []
for segment in segments:
    if segment.words:
        for word in segment.words:
            words.append({
                "word": word.word.strip(),
                "start": round(word.start, 3),
                "end": round(word.end, 3)
            })

print(json.dumps(words))
PYEOF
}

# Align and output in SpanDoc timing format
# Usage: vox_align_spans <audio_file> [model]
# Output: JSON object with timing spans for SpanDoc
vox_align_spans() {
    local audio_file="$1"
    local model="${2:-$VOX_ALIGN_MODEL}"

    if [[ ! -f "$audio_file" ]]; then
        echo "Error: Audio file not found: $audio_file" >&2
        return 1
    fi

    tetra_python_activate >/dev/null 2>&1 || return 1

    if ! vox_align_check; then
        echo "Error: faster-whisper not installed" >&2
        echo "Install with: vox align install" >&2
        return 1
    fi

    python3 <<PYEOF
import sys
import json
from faster_whisper import WhisperModel

model = WhisperModel("$model", device="cpu", compute_type="int8")
segments, info = model.transcribe("$audio_file", word_timestamps=True)

# Build timing spans (token index based)
timing = []
token_idx = 0
for segment in segments:
    if segment.words:
        for word in segment.words:
            timing.append({
                "start": token_idx,
                "end": token_idx + 1,
                "label": "",
                "attrs": {
                    "t0": round(word.start, 3),
                    "t1": round(word.end, 3)
                }
            })
            token_idx += 1

# Output SpanDoc format
result = {"timing": timing}
print(json.dumps(result))
PYEOF
}

# Align and output in legacy timeline cue format (for AnimEngine/director)
# Usage: vox_align_cues <audio_file> [model]
# Output: JSON array of cues [{text, start, end}, ...]
vox_align_cues() {
    local audio_file="$1"
    local model="${2:-$VOX_ALIGN_MODEL}"

    if [[ ! -f "$audio_file" ]]; then
        echo "Error: Audio file not found: $audio_file" >&2
        return 1
    fi

    tetra_python_activate >/dev/null 2>&1 || return 1

    if ! vox_align_check; then
        echo "Error: faster-whisper not installed" >&2
        echo "Install with: vox align install" >&2
        return 1
    fi

    python3 <<PYEOF
import sys
import json
from faster_whisper import WhisperModel

model = WhisperModel("$model", device="cpu", compute_type="int8")
segments, info = model.transcribe("$audio_file", word_timestamps=True)

cues = []
for segment in segments:
    if segment.words:
        for word in segment.words:
            cues.append({
                "text": word.word.strip(),
                "start": round(word.start, 3),
                "end": round(word.end, 3),
                "fx": "highlight"
            })

print(json.dumps(cues))
PYEOF
}

# Generate audio and align in one step
# Usage: echo "text" | vox_align_generate <voice> [output_file]
# Output: JSON with audioFile and cues
vox_align_generate() {
    local voice="${1:-shimmer}"
    local output_file="$2"

    # Read text from stdin
    local text
    text=$(cat)

    if [[ -z "$text" ]]; then
        echo "Error: No input text provided" >&2
        return 1
    fi

    # Generate audio
    local audio_path
    if [[ -n "$output_file" ]]; then
        audio_path="$output_file"
        echo "$text" | vox generate "$voice" --output "$audio_path" >/dev/null 2>&1
    else
        # Generate to temp file
        audio_path=$(mktemp /tmp/vox_align_XXXXXX.mp3)
        echo "$text" | vox generate "$voice" --output "$audio_path" >/dev/null 2>&1
    fi

    if [[ $? -ne 0 || ! -f "$audio_path" ]]; then
        echo "Error: Audio generation failed" >&2
        return 1
    fi

    # Get alignment
    local cues
    cues=$(vox_align_cues "$audio_path")

    if [[ $? -ne 0 ]]; then
        echo "Error: Alignment failed" >&2
        [[ -z "$output_file" ]] && rm -f "$audio_path"
        return 1
    fi

    # Output combined result
    python3 -c "
import json
cues = json.loads('''$cues''')
print(json.dumps({
    'audioFile': '$audio_path',
    'cues': cues,
    'text': '''$text'''
}, indent=2))
"

    # Clean up temp file if not explicitly saved
    if [[ -z "$output_file" ]]; then
        # Keep the file but note it's temporary
        echo "Note: Audio at $audio_path (temporary)" >&2
    fi
}

# Main align subcommand handler
vox_align() {
    local subcmd="${1:-status}"
    shift || true

    case "$subcmd" in
        install|i)
            vox_align_install
            ;;
        status|s)
            vox_align_status
            ;;
        file|f)
            # vox align file <audio.mp3> [model]
            vox_align_file "$@"
            ;;
        spans)
            # vox align spans <audio.mp3> [model] - SpanDoc format
            vox_align_spans "$@"
            ;;
        cues|c)
            # vox align cues <audio.mp3> [model] - Legacy timeline format
            vox_align_cues "$@"
            ;;
        generate|g)
            # echo "text" | vox align generate <voice> [output.mp3]
            vox_align_generate "$@"
            ;;
        help|h|*)
            cat <<'EOF'
vox align - Word-level alignment using faster-whisper

Usage: vox align <command> [options]

Setup:
  install             Install faster-whisper
  status              Show installation status

Alignment:
  file <audio> [model]    Get word timings from audio file
  cues <audio> [model]    Output in timeline cue format (AnimEngine)
  spans <audio> [model]   Output in SpanDoc spans format

Generate + Align:
  generate <voice> [out]  Generate audio from stdin, return with cues

Models (speed vs accuracy):
  tiny    Fastest, good for dev
  base    Fast, better accuracy (default for most uses)
  small   Medium speed, good accuracy
  medium  Slower, high accuracy
  large   Slowest, best accuracy

Environment:
  VOX_ALIGN_MODEL     Default model (default: tiny)

Examples:
  # Check status
  vox align status

  # Install faster-whisper
  vox align install

  # Align existing audio file
  vox align file narration.mp3
  vox align cues narration.mp3 base

  # Generate and align in one step
  echo "Hello world" | vox align generate shimmer
  echo "Hello world" | vox align generate coqui:vits output.wav

  # Get SpanDoc format for browser
  vox align spans narration.mp3

Output formats:
  file:   [{"word": "Hello", "start": 0.0, "end": 0.5}, ...]
  cues:   [{"text": "Hello", "start": 0.0, "end": 0.5, "fx": "highlight"}, ...]
  spans:  {"timing": [{"start": 0, "end": 1, "attrs": {"t0": 0.0, "t1": 0.5}}, ...]}
EOF
            ;;
    esac
}
