#!/usr/bin/env bash

# voxlab_pipeline.sh - Pipeline definition and stage execution

_voxlab_pipeline_cmd() {
    local subcmd="${1:-list}"
    shift || true

    case "$subcmd" in
        define)  _voxlab_pipeline_define "$@" ;;
        list|ls) _voxlab_pipeline_list "$@" ;;
        show)    _voxlab_pipeline_show "$@" ;;
        help)    echo "Usage: voxlab pipeline {define|list|show} ..." ;;
        *)
            echo "voxlab pipeline: unknown '$subcmd'" >&2
            return 1
            ;;
    esac
}

_voxlab_pipeline_define() {
    local name="${1:?Usage: voxlab pipeline define <name> <stage1> <stage2> ...}"
    shift

    if [[ $# -eq 0 ]]; then
        echo "voxlab: at least one stage required" >&2
        return 1
    fi

    # Validate stages exist in registry
    local stage
    for stage in "$@"; do
        if [[ -z "${VOXLAB_STAGES[$stage]+x}" ]]; then
            echo "voxlab: unknown stage '$stage'" >&2
            echo "  Available: ${!VOXLAB_STAGES[*]}" >&2
            return 1
        fi
    done

    local pipelines_dir="$VOXLAB_DIR/pipelines"
    mkdir -p "$pipelines_dir"

    local file="$pipelines_dir/${name}.json"
    {
        echo "{"
        echo "  \"name\": \"$name\","
        echo "  \"stages\": ["
        local first=true
        for stage in "$@"; do
            $first || echo ","
            first=false
            printf '    "%s"' "$stage"
        done
        echo ""
        echo "  ],"
        echo "  \"created\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\""
        echo "}"
    } > "$file"

    echo "Pipeline '$name' defined: $*"
    echo "  file: $file"
}

_voxlab_pipeline_list() {
    local pipelines_dir="$VOXLAB_DIR/pipelines"
    if [[ ! -d "$pipelines_dir" ]] || [[ -z "$(ls -A "$pipelines_dir" 2>/dev/null)" ]]; then
        echo "No pipelines defined."
        echo "  Use 'voxlab pipeline define <name> <stage1> ...' to create one"
        return 0
    fi

    printf "%-20s %s\n" "PIPELINE" "STAGES"
    printf "%-20s %s\n" "--------" "------"

    local f
    for f in "$pipelines_dir"/*.json; do
        [[ -f "$f" ]] || continue
        local name
        name=$(basename "$f" .json)
        local stages
        stages=$(grep -o '"stages":\[.*\]' "$f" | sed 's/"stages":\[//;s/\]//;s/"//g;s/,/ → /g' | tr -d ' ')
        printf "%-20s %s\n" "$name" "$stages"
    done
}

_voxlab_pipeline_show() {
    local name="${1:?Usage: voxlab pipeline show <name>}"
    local file="$VOXLAB_DIR/pipelines/${name}.json"

    if [[ ! -f "$file" ]]; then
        echo "voxlab: pipeline '$name' not found" >&2
        return 1
    fi

    cat "$file"
}

# Stage execution stubs - these delegate to actual implementations
voxlab_stage_text() {
    local input="$1" output="$2"
    # Text passthrough - just copy
    cp "$input" "$output"
}

voxlab_stage_g2p_espeak() {
    local input="$1" output="$2"
    # Delegate to vox G2P if available
    if declare -f vox_g2p_text &>/dev/null; then
        vox_g2p_text "$(cat "$input")" > "$output"
    else
        echo "voxlab: g2p:espeak requires vox module" >&2
        return 1
    fi
}

voxlab_stage_acoustic() {
    local input="$1" output="$2" config="${3:-}"
    # Acoustic model training - handled by python/train.py
    echo "acoustic stage: delegated to python trainer"
}

voxlab_stage_vocoder_opus() {
    local input="$1" output="$2"
    if declare -f vocoder &>/dev/null; then
        vocoder encode "$input" opus "$output"
    else
        echo "voxlab: vocoder:opus requires vocoder module" >&2
        return 1
    fi
}

voxlab_stage_vocoder_c2() {
    local input="$1" output="$2"
    if declare -f vocoder &>/dev/null; then
        vocoder encode "$input" c2 "$output"
    else
        echo "voxlab: vocoder:c2 requires vocoder module" >&2
        return 1
    fi
}

voxlab_stage_formant() {
    local input="$1" output="$2"
    if declare -f formant_phoneme &>/dev/null; then
        formant_phoneme "$(cat "$input")" > "$output"
    else
        echo "voxlab: formant:synth requires formant module" >&2
        return 1
    fi
}

voxlab_stage_vox_openai() {
    local input="$1" output="$2"
    if declare -f vox &>/dev/null; then
        vox generate "$(cat "$input")" openai:shimmer "$output"
    else
        echo "voxlab: vox:openai requires vox module" >&2
        return 1
    fi
}

voxlab_stage_vox_coqui() {
    local input="$1" output="$2"
    if declare -f vox &>/dev/null; then
        vox generate "$(cat "$input")" coqui:vits "$output"
    else
        echo "voxlab: vox:coqui requires vox module" >&2
        return 1
    fi
}

export -f _voxlab_pipeline_cmd _voxlab_pipeline_define _voxlab_pipeline_list _voxlab_pipeline_show
export -f voxlab_stage_text voxlab_stage_g2p_espeak voxlab_stage_acoustic
export -f voxlab_stage_vocoder_opus voxlab_stage_vocoder_c2 voxlab_stage_formant
export -f voxlab_stage_vox_openai voxlab_stage_vox_coqui
