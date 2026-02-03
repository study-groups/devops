#!/usr/bin/env bash

# vox_coqui.sh - Local TTS using Coqui TTS
# Requires: pip install TTS (in tetra python env)
# Output: ~/tetra/vox/db/$EPOCH.vox.coqui-$preset.wav

# Coqui model presets
VOX_COQUI_MODEL_XTTS="tts_models/multilingual/multi-dataset/xtts_v2"
VOX_COQUI_MODEL_TACOTRON="tts_models/en/ljspeech/tacotron2-DDC"
VOX_COQUI_MODEL_VITS="tts_models/en/ljspeech/vits"
VOX_COQUI_MODEL_DEFAULT="$VOX_COQUI_MODEL_VITS"

# Resolve model preset name to full model path
# Returns: full model path
_vox_coqui_resolve_model() {
    local model="$1"
    case "$model" in
        vits|fast)
            echo "$VOX_COQUI_MODEL_VITS"
            ;;
        tacotron|classic)
            echo "$VOX_COQUI_MODEL_TACOTRON"
            ;;
        xtts|best)
            echo "$VOX_COQUI_MODEL_XTTS"
            ;;
        *)
            echo "$model"
            ;;
    esac
}

# Get kind name from model (for file naming)
# Returns: coqui-vits, coqui-tacotron, coqui-xtts
_vox_coqui_get_kind() {
    local model="$1"
    case "$model" in
        vits|fast|*vits*)
            echo "coqui-vits"
            ;;
        tacotron|classic|*tacotron*)
            echo "coqui-tacotron"
            ;;
        xtts|best|*xtts*)
            echo "coqui-xtts"
            ;;
        *)
            echo "coqui-local"
            ;;
    esac
}

# Get db path for coqui audio: $EPOCH.vox.$kind.wav
vox_coqui_get_db_path() {
    local timestamp="$1"
    local kind="$2"
    local db_dir=$(vox_get_db_dir)
    echo "${db_dir}/${timestamp}.vox.${kind}.wav"
}

# Check if Coqui TTS is installed
vox_coqui_check() {
    tetra_python_activate >/dev/null 2>&1 || {
        echo "Error: tetra python environment not available" >&2
        return 1
    }

    if python -c "import TTS" 2>/dev/null; then
        return 0
    else
        return 1
    fi
}

# Get Coqui TTS version
vox_coqui_version() {
    tetra_python_activate >/dev/null 2>&1 || return 1
    python -c "import TTS; print(TTS.__version__)" 2>/dev/null
}

# Install Coqui TTS and faster-whisper (for alignment)
vox_coqui_install() {
    echo "Installing Coqui TTS and faster-whisper..."
    tetra_python_activate || {
        echo "Error: Failed to activate tetra python environment" >&2
        return 1
    }

    pip install TTS faster-whisper
    local result=$?

    if [[ $result -eq 0 ]]; then
        echo "Coqui TTS and faster-whisper installed successfully"
        vox_coqui_status
    else
        echo "Error: Installation failed" >&2
        return 1
    fi
}

# Show Coqui status
vox_coqui_status() {
    echo "Coqui TTS Status"
    echo "================"

    if ! tetra_python_activate >/dev/null 2>&1; then
        echo "Python: Not available (run tetra_python_activate)"
        return 1
    fi

    if vox_coqui_check; then
        local version=$(vox_coqui_version)
        echo "Installed: Yes (v$version)"

        # Check for downloaded models
        local models_dir="${HOME}/.local/share/tts"
        if [[ -d "$models_dir" ]]; then
            local model_count=$(find "$models_dir" -name "*.pth" 2>/dev/null | wc -l | tr -d ' ')
            echo "Downloaded models: $model_count"
        else
            echo "Downloaded models: 0 (will download on first use)"
        fi

        echo ""
        echo "Default model: $VOX_COQUI_MODEL_DEFAULT"
        echo ""
        echo "Available presets:"
        echo "  vits      - Fast, good quality (default)"
        echo "  tacotron  - Classic, reliable"
        echo "  xtts      - Best quality, slow, multilingual"
    else
        echo "Installed: No"
        echo ""
        echo "Install with: vox coqui install"
    fi
}

# List available Coqui models
vox_coqui_models() {
    tetra_python_activate >/dev/null 2>&1 || return 1

    if ! vox_coqui_check; then
        echo "Error: Coqui TTS not installed" >&2
        echo "Install with: vox coqui install" >&2
        return 1
    fi

    echo "Available Coqui TTS models:"
    echo "==========================="
    python -c "from TTS.api import TTS; print('\n'.join(TTS().list_models()))" 2>/dev/null | grep "^tts_models/en" | head -20
    echo ""
    echo "(Showing English models only. Use 'tts --list_models' for full list)"
}

# Generate TTS using Coqui (local)
# Usage: echo "text" | vox_coqui_generate [output_file] [model_spec]
# model_spec: vits, tacotron, xtts/SpeakerName (underscore for spaces)
# If no output_file, generates to db: $EPOCH.vox.coqui-$preset.wav
vox_coqui_generate() {
    local output_file="${1:-}"
    local model_input="${2:-vits}"

    tetra_python_activate >/dev/null 2>&1 || return 1

    if ! vox_coqui_check; then
        echo "Error: Coqui TTS not installed" >&2
        echo "Install with: vox coqui install" >&2
        return 1
    fi

    # Read text from stdin
    local text
    text=$(cat)

    if [[ -z "$text" ]]; then
        echo "Error: No input text provided" >&2
        return 1
    fi

    # Parse model spec: "xtts/Speaker_Name" → model=xtts, speaker="Speaker Name"
    local base_model="$model_input"
    local speaker=""
    if [[ "$model_input" == */* ]]; then
        base_model="${model_input%%/*}"
        speaker="${model_input#*/}"
        speaker="${speaker//_/ }"
    fi

    # Resolve model preset to full path and kind
    local model=$(_vox_coqui_resolve_model "$base_model")
    local kind=$(_vox_coqui_get_kind "$base_model")

    # Generate to db if no output specified
    local to_stdout=false
    if [[ -z "$output_file" ]]; then
        vox_ensure_db_dir
        local timestamp=$(date +%s)
        output_file=$(vox_coqui_get_db_path "$timestamp" "$kind")
        to_stdout=true
    fi

    # Call Coqui TTS (redirect all TTS output to stderr)
    echo "Generating with Coqui ($kind)..." >&2

    python -c "
import sys, os
sys.stdout = sys.stderr

# Patch torch.load for xtts compatibility with PyTorch 2.6+
import torch
_orig_load = torch.load
def _patched_load(*args, **kwargs):
    kwargs.setdefault('weights_only', False)
    return _orig_load(*args, **kwargs)
torch.load = _patched_load

from TTS.api import TTS

text = '''$text'''
model = '$model'
output = '$output_file'
speaker = '$speaker' or None
language = 'en' if speaker else None

tts = TTS(model_name=model, progress_bar=False)
tts.tts_to_file(text=text, file_path=output, speaker=speaker, language=language)
" 2>/dev/null

    local result=$?

    if [[ $result -ne 0 ]]; then
        echo "Error: Coqui TTS generation failed" >&2
        return 1
    fi

    # Report output path
    if [[ "$to_stdout" == "true" ]]; then
        echo "Saved: $output_file" >&2
        echo "$output_file"
    fi

    return 0
}

# Generate and play using Coqui
# Saves to db: $EPOCH.vox.coqui-$preset.wav
vox_coqui_play() {
    local model_input="${1:-vits}"

    # Read stdin into variable (can't read twice)
    local text
    text=$(cat)

    if [[ -z "$text" ]]; then
        echo "Error: No input text provided" >&2
        return 1
    fi

    # Generate to db
    local audio_file
    audio_file=$(echo "$text" | vox_coqui_generate "" "$model_input")

    if [[ $? -ne 0 || -z "$audio_file" ]]; then
        return 1
    fi

    # Play the generated file
    vox_play_audio "$audio_file"
}

# Initialize Coqui voice profiles
vox_coqui_init_profiles() {
    local voice_dir="${VOX_DIR:-$TETRA_DIR/vox}/voice-available"
    mkdir -p "$voice_dir"

    cat > "$voice_dir/coqui-vits.toml" <<'EOF'
# Coqui VITS - Fast local TTS

[voice]
id = "coqui-vits"
display_name = "Coqui VITS"
description = "Fast, good quality local TTS"

[provider]
name = "coqui"
model = "tts_models/en/ljspeech/vits"
local = true

[pricing]
cost_per_1m_chars = 0.00
currency = "USD"

[metadata]
tags = ["local", "fast", "free"]
quality = "standard"
use_cases = ["testing", "offline", "development"]
language = "en-US"
EOF

    cat > "$voice_dir/coqui-xtts.toml" <<'EOF'
# Coqui XTTS v2 - Best quality local TTS

[voice]
id = "coqui-xtts"
display_name = "Coqui XTTS"
description = "Best quality multilingual local TTS"

[provider]
name = "coqui"
model = "tts_models/multilingual/multi-dataset/xtts_v2"
local = true

[pricing]
cost_per_1m_chars = 0.00
currency = "USD"

[metadata]
tags = ["local", "high-quality", "multilingual", "free"]
quality = "high"
use_cases = ["production", "multilingual", "voice-cloning"]
language = "multilingual"
EOF

    echo "Created Coqui voice profiles in $voice_dir"
}

# Main coqui subcommand handler
vox_coqui() {
    local subcmd="${1:-status}"
    shift || true

    case "$subcmd" in
        install|i)
            vox_coqui_install
            ;;
        status|s)
            vox_coqui_status
            ;;
        models|m)
            vox_coqui_models
            ;;
        init)
            vox_coqui_init_profiles
            ;;
        generate|g)
            # echo "text" | vox coqui generate [output.wav] [model]
            vox_coqui_generate "$@"
            ;;
        play|p)
            # echo "text" | vox coqui play [model]
            vox_coqui_play "$@"
            ;;
        help|h|*)
            cat <<'EOF'
vox coqui - Local TTS using Coqui TTS

Usage: vox coqui <command> [options]

Setup:
  install           Install Coqui TTS (pip install TTS)
  status            Show installation status and info
  models            List available English models
  init              Create Coqui voice profiles in VOX_DIR

Generation:
  generate [file] [model]   Generate audio from stdin
  play [model]              Generate and play from stdin

Model presets:
  vits      Fast, good quality (default)
  tacotron  Classic, reliable
  xtts      Best quality, slow, multilingual

Examples:
  # Check status
  vox coqui status

  # Install Coqui TTS
  vox coqui install

  # Generate and play locally
  echo "Hello world" | vox coqui play
  echo "Hello world" | vox coqui play xtts

  # Generate to file
  echo "Hello world" | vox coqui generate output.wav
  echo "Hello world" | vox coqui generate output.wav tacotron

Note: First run downloads the model (~100MB-1GB depending on model).
      Uses tetra python environment (tetra_python_activate).
EOF
            ;;
    esac
}
