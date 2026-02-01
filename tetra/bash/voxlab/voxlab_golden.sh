#!/usr/bin/env bash

# voxlab_golden.sh - Golden reference management

_voxlab_golden_cmd() {
    local subcmd="${1:-list}"
    shift || true

    case "$subcmd" in
        create)   _voxlab_golden_create "$@" ;;
        list|ls)  _voxlab_golden_list "$@" ;;
        compare)  _voxlab_golden_compare "$@" ;;
        help)     echo "Usage: voxlab golden {create|list|compare} ..." ;;
        *)
            echo "voxlab golden: unknown '$subcmd'" >&2
            return 1
            ;;
    esac
}

_voxlab_golden_create() {
    local text="${1:?Usage: voxlab golden create <text> [voice_spec]}"
    local voice_spec="${2:-openai:shimmer}"

    local golden_dir="$VOXLAB_DIR/golden"
    mkdir -p "$golden_dir"

    local epoch
    epoch=$(date +%s)
    local bundle_dir="$golden_dir/$epoch"
    mkdir -p "$bundle_dir"

    # Save text
    echo "$text" > "$bundle_dir/text.txt"

    # Generate via vox
    echo "voxlab golden: generating via $voice_spec..."
    if declare -f vox &>/dev/null; then
        vox generate "$text" "$voice_spec"
        # Find the most recent vox output
        local vox_db="${VOX_DIR:-$TETRA_DIR/vox}/db"
        local latest
        latest=$(ls -t "$vox_db"/*.wav "$vox_db"/*.mp3 2>/dev/null | head -1)
        if [[ -n "$latest" ]]; then
            cp "$latest" "$bundle_dir/reference$(basename "$latest" | sed 's/.*\./\./')"
            echo "  reference: $bundle_dir/reference$(basename "$latest" | sed 's/.*\./\./')"
        fi
    else
        echo "  vox module not available, skipping audio generation" >&2
        echo "  create audio manually and place in: $bundle_dir/" >&2
    fi

    # Encode to codec formats if vocoder available
    local ref_audio
    ref_audio=$(ls "$bundle_dir"/reference.* 2>/dev/null | head -1)
    if [[ -n "$ref_audio" ]] && declare -f vocoder &>/dev/null; then
        echo "  encoding to opus..."
        vocoder encode "$ref_audio" opus "$bundle_dir/reference.opus" 2>/dev/null
        echo "  encoding to c2..."
        vocoder encode "$ref_audio" c2 "$bundle_dir/reference.c2" 2>/dev/null
    fi

    # Write metadata
    cat > "$bundle_dir/meta.json" <<EOF
{
  "epoch": $epoch,
  "text": $(printf '%s' "$text" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))' 2>/dev/null || echo "\"$text\""),
  "voice_spec": "$voice_spec",
  "created": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

    echo "  id: golden:$epoch"
    echo "  dir: $bundle_dir"
}

_voxlab_golden_list() {
    local golden_dir="$VOXLAB_DIR/golden"
    if [[ ! -d "$golden_dir" ]] || [[ -z "$(ls -A "$golden_dir" 2>/dev/null)" ]]; then
        echo "No golden references."
        echo "  Use 'voxlab golden create <text> [voice_spec]' to create one"
        return 0
    fi

    printf "%-16s %-20s %-40s %s\n" "ID" "VOICE" "TEXT" "FILES"
    printf "%-16s %-20s %-40s %s\n" "--" "-----" "----" "-----"

    local d
    for d in "$golden_dir"/*/; do
        [[ -d "$d" ]] || continue
        local epoch
        epoch=$(basename "$d")
        local text="-" voice="-"

        if [[ -f "$d/meta.json" ]]; then
            voice=$(grep -o '"voice_spec":"[^"]*"' "$d/meta.json" | cut -d'"' -f4)
            text=$(grep -o '"text":"[^"]*"' "$d/meta.json" | cut -d'"' -f4)
        elif [[ -f "$d/text.txt" ]]; then
            text=$(head -c 40 "$d/text.txt")
        fi

        # Truncate text
        [[ ${#text} -gt 38 ]] && text="${text:0:35}..."

        local files
        files=$(ls "$d" 2>/dev/null | grep -v meta.json | grep -v text.txt | tr '\n' ' ')

        printf "%-16s %-20s %-40s %s\n" "golden:$epoch" "$voice" "$text" "$files"
    done
}

_voxlab_golden_compare() {
    local golden_id="${1:?Usage: voxlab golden compare <golden_id> <audio_file>}"
    local audio_file="${2:?Usage: voxlab golden compare <golden_id> <audio_file>}"

    local golden_dir
    golden_dir=$(_voxlab_golden_resolve "$golden_id")
    if [[ $? -ne 0 ]]; then
        echo "voxlab: golden ref '$golden_id' not found" >&2
        return 1
    fi

    local ref_audio
    ref_audio=$(ls "$golden_dir"/reference.* 2>/dev/null | head -1)
    if [[ -z "$ref_audio" ]]; then
        echo "voxlab: no reference audio in golden bundle" >&2
        return 1
    fi

    if [[ ! -f "$audio_file" ]]; then
        echo "voxlab: audio file '$audio_file' not found" >&2
        return 1
    fi

    local python_cmd="python3"
    if [[ -n "${TETRA_PYTHON_VENV:-}" && -f "$TETRA_PYTHON_VENV/bin/python3" ]]; then
        python_cmd="$TETRA_PYTHON_VENV/bin/python3"
    fi

    echo "Comparing: $audio_file → $ref_audio"
    $python_cmd "$VOXLAB_SRC/python/metrics.py" \
        --reference "$ref_audio" \
        --candidate "$audio_file"
}

# Resolve golden:EPOCH or golden:latest to directory path
_voxlab_golden_resolve() {
    local ref="$1"
    local golden_dir="$VOXLAB_DIR/golden"

    # Strip "golden:" prefix
    ref="${ref#golden:}"

    if [[ "$ref" == "latest" ]]; then
        # Find most recent
        local latest
        latest=$(ls -d "$golden_dir"/*/ 2>/dev/null | sort -n | tail -1)
        if [[ -n "$latest" ]]; then
            echo "$latest"
            return 0
        fi
        return 1
    fi

    if [[ -d "$golden_dir/$ref" ]]; then
        echo "$golden_dir/$ref"
        return 0
    fi

    return 1
}

export -f _voxlab_golden_cmd _voxlab_golden_create _voxlab_golden_list
export -f _voxlab_golden_compare _voxlab_golden_resolve
