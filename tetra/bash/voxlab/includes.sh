#!/usr/bin/env bash

# voxlab/includes.sh - ML Experiment Tracking + TTS Pipeline Composition

if [[ ${BASH_VERSINFO[0]} -lt 5 || (${BASH_VERSINFO[0]} -eq 5 && ${BASH_VERSINFO[1]} -lt 2) ]]; then
    echo "voxlab: requires bash 5.2+, found ${BASH_VERSION}" >&2
    return 1
fi

[[ -n "$_VOXLAB_LOADED" ]] && return 0
declare -g _VOXLAB_LOADED=1

: "${TETRA_SRC:?TETRA_SRC must be set}"
: "${TETRA_DIR:=$HOME/tetra}"

source "$TETRA_SRC/bash/utils/module_init.sh"
source "$TETRA_SRC/bash/utils/function_helpers.sh"

tetra_module_init_with_alias "voxlab" "VOXLAB" "experiments:golden:logs:pipelines"

# Pipeline stage registry
declare -gA VOXLAB_STAGES=(
    [text]="voxlab_stage_text"
    [g2p:espeak]="voxlab_stage_g2p_espeak"
    [acoustic:lstm]="voxlab_stage_acoustic"
    [vocoder:opus]="voxlab_stage_vocoder_opus"
    [vocoder:c2]="voxlab_stage_vocoder_c2"
    [formant:synth]="voxlab_stage_formant"
    [vox:openai]="voxlab_stage_vox_openai"
    [vox:coqui]="voxlab_stage_vox_coqui"
)

source "$VOXLAB_SRC/voxlab_experiment.sh"
source "$VOXLAB_SRC/voxlab_pipeline.sh"
source "$VOXLAB_SRC/voxlab_golden.sh"
source "$VOXLAB_SRC/voxlab_trigger.sh"
source "$VOXLAB_SRC/voxlab.sh"
source "$VOXLAB_SRC/voxlab_complete.sh"

export VOXLAB_SRC VOXLAB_DIR
export -f voxlab
