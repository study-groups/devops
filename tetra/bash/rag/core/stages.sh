#!/usr/bin/env bash
# stages.sh - Configurable flow stage definitions
#
# RAG extends TTM's base stages with finer-grained workflow states.
# This module defines the stage mapping and metadata.

# Prevent double-sourcing
[[ -n "${RAG_STAGES_LOADED:-}" ]] && return 0
RAG_STAGES_LOADED=1

# =============================================================================
# TTM BASE STAGES (from Tetra Transaction Manager)
# =============================================================================

declare -r TTM_STAGE_NEW="NEW"
declare -r TTM_STAGE_SELECT="SELECT"
declare -r TTM_STAGE_ASSEMBLE="ASSEMBLE"
declare -r TTM_STAGE_EXECUTE="EXECUTE"
declare -r TTM_STAGE_VALIDATE="VALIDATE"
declare -r TTM_STAGE_DONE="DONE"
declare -r TTM_STAGE_FAIL="FAIL"

# =============================================================================
# RAG EXTENDED STAGES
# =============================================================================
# RAG adds granularity to the EXECUTE phase:
#   TTM: NEW → SELECT → ASSEMBLE → EXECUTE → VALIDATE → DONE/FAIL
#   RAG: NEW → SELECT → ASSEMBLE → SUBMIT → APPLY → VALIDATE → FOLD → DONE/FAIL

declare -r RAG_STAGE_NEW="NEW"
declare -r RAG_STAGE_SELECT="SELECT"
declare -r RAG_STAGE_ASSEMBLE="ASSEMBLE"
declare -r RAG_STAGE_SUBMIT="SUBMIT"      # Context sent to LLM
declare -r RAG_STAGE_APPLY="APPLY"        # LLM response being applied
declare -r RAG_STAGE_VALIDATE="VALIDATE"  # Testing/validation
declare -r RAG_STAGE_FOLD="FOLD"          # Iteration/retry
declare -r RAG_STAGE_DONE="DONE"
declare -r RAG_STAGE_FAIL="FAIL"

# =============================================================================
# STAGE REGISTRY
# =============================================================================
# Format: STAGE:TTM_MAPPING:COLOR:SYMBOL:DESCRIPTION:NEXT_ACTIONS

declare -a RAG_STAGE_REGISTRY=(
    "NEW:NEW:blue:○:Flow created, ready to gather evidence:Add evidence with /e add <file>"
    "SELECT:SELECT:purple:◐:Evidence being collected and curated:Continue adding evidence or /assemble"
    "ASSEMBLE:ASSEMBLE:darkpurple:◑:Context being built from evidence:Review context, then /submit"
    "SUBMIT:EXECUTE:orange:◕:Context submitted to LLM agent:Wait for response"
    "APPLY:EXECUTE:brightorange:◔:Agent changes being applied:Apply changes, then /validate"
    "VALIDATE:VALIDATE:red:◓:Testing/validation of results:Run tests, check results"
    "FOLD:EXECUTE:yellow:↻:Iteration/retry phase:Refine and resubmit"
    "DONE:DONE:green:✓:Flow completed:Review outcomes, /tag to promote"
    "FAIL:FAIL:red:✗:Flow failed:Check errors, retry or abandon"
)

# Outcome badges for DONE state
declare -A RAG_OUTCOME_BADGES=(
    [success]="✓"
    [partial]="⚠"
    [abandoned]="○"
    [failed]="✗"
)

# Outcome colors
declare -A RAG_OUTCOME_COLORS=(
    [success]="green"
    [partial]="yellow"
    [abandoned]="gray"
    [failed]="red"
)

# =============================================================================
# STAGE MAPPING FUNCTIONS
# =============================================================================

# Map RAG stage to TTM stage
rag_stage_to_ttm() {
    local rag_stage="$1"
    for entry in "${RAG_STAGE_REGISTRY[@]}"; do
        local stage="${entry%%:*}"
        if [[ "$stage" == "$rag_stage" ]]; then
            local rest="${entry#*:}"
            local ttm="${rest%%:*}"
            echo "$ttm"
            return 0
        fi
    done
    # Default: pass through
    echo "$rag_stage"
}

# Get all valid RAG stages
rag_get_stages() {
    local stages=""
    for entry in "${RAG_STAGE_REGISTRY[@]}"; do
        local stage="${entry%%:*}"
        stages+="$stage "
    done
    echo "$stages"
}

# Get stage color
rag_stage_color() {
    local stage="$1"
    for entry in "${RAG_STAGE_REGISTRY[@]}"; do
        local s="${entry%%:*}"
        if [[ "$s" == "$stage" ]]; then
            IFS=':' read -r _ _ color _ <<< "$entry"
            echo "$color"
            return 0
        fi
    done
    echo "white"
}

# Get stage symbol
rag_stage_symbol() {
    local stage="$1"
    for entry in "${RAG_STAGE_REGISTRY[@]}"; do
        local s="${entry%%:*}"
        if [[ "$s" == "$stage" ]]; then
            IFS=':' read -r _ _ _ symbol _ <<< "$entry"
            echo "$symbol"
            return 0
        fi
    done
    echo "•"
}

# Get stage description
rag_stage_description() {
    local stage="$1"
    for entry in "${RAG_STAGE_REGISTRY[@]}"; do
        local s="${entry%%:*}"
        if [[ "$s" == "$stage" ]]; then
            IFS=':' read -r _ _ _ _ desc _ <<< "$entry"
            echo "$desc"
            return 0
        fi
    done
}

# Get next actions for a stage
rag_stage_next_actions() {
    local stage="$1"
    for entry in "${RAG_STAGE_REGISTRY[@]}"; do
        local s="${entry%%:*}"
        if [[ "$s" == "$stage" ]]; then
            local actions="${entry##*:}"
            echo "$actions"
            return 0
        fi
    done
}

# =============================================================================
# OUTCOME FUNCTIONS
# =============================================================================

# Get outcome badge
rag_outcome_badge() {
    local outcome="$1"
    echo "${RAG_OUTCOME_BADGES[$outcome]:-•}"
}

# Get outcome color
rag_outcome_color() {
    local outcome="$1"
    echo "${RAG_OUTCOME_COLORS[$outcome]:-white}"
}

# Get all valid outcomes
rag_get_outcomes() {
    echo "success partial abandoned failed"
}

# =============================================================================
# STAGE TRANSITION VALIDATION
# =============================================================================

# Define valid transitions: FROM → TO (comma-separated destinations)
declare -A RAG_STAGE_TRANSITIONS=(
    [NEW]="SELECT,FAIL"
    [SELECT]="ASSEMBLE,FAIL"
    [ASSEMBLE]="SUBMIT,SELECT,FAIL"
    [SUBMIT]="APPLY,FAIL"
    [APPLY]="VALIDATE,FOLD,FAIL"
    [VALIDATE]="DONE,FOLD,FAIL"
    [FOLD]="SUBMIT,DONE,FAIL"
    [DONE]=""
    [FAIL]=""
)

# Check if a transition is valid
rag_can_transition() {
    local from="$1"
    local to="$2"

    local valid="${RAG_STAGE_TRANSITIONS[$from]}"
    if [[ -z "$valid" ]]; then
        return 1  # Terminal state or unknown
    fi

    if [[ ",$valid," == *",$to,"* ]]; then
        return 0
    fi
    return 1
}

# Get valid transitions from a stage
rag_valid_transitions() {
    local from="$1"
    echo "${RAG_STAGE_TRANSITIONS[$from]//,/ }"
}

# =============================================================================
# ANSI COLOR MAPPING
# =============================================================================
# Maps color names to ANSI codes (can be overridden by TDS)

declare -A RAG_STAGE_ANSI=(
    [blue]="\033[38;5;75m"
    [purple]="\033[38;5;141m"
    [darkpurple]="\033[38;5;99m"
    [orange]="\033[38;5;208m"
    [brightorange]="\033[38;5;214m"
    [red]="\033[38;5;196m"
    [yellow]="\033[38;5;220m"
    [green]="\033[38;5;82m"
    [gray]="\033[38;5;245m"
    [white]="\033[38;5;255m"
    [reset]="\033[0m"
)

# Get ANSI code for stage
rag_stage_ansi() {
    local stage="$1"
    local color=$(rag_stage_color "$stage")
    echo "${RAG_STAGE_ANSI[$color]:-${RAG_STAGE_ANSI[white]}}"
}

# Format stage with color
rag_format_stage() {
    local stage="$1"
    local ansi=$(rag_stage_ansi "$stage")
    local symbol=$(rag_stage_symbol "$stage")
    local reset="${RAG_STAGE_ANSI[reset]}"
    echo -e "${ansi}${symbol} ${stage}${reset}"
}

# =============================================================================
# EXPORTS
# =============================================================================

export RAG_STAGES_LOADED
export -f rag_stage_to_ttm
export -f rag_get_stages
export -f rag_stage_color
export -f rag_stage_symbol
export -f rag_stage_description
export -f rag_stage_next_actions
export -f rag_outcome_badge
export -f rag_outcome_color
export -f rag_get_outcomes
export -f rag_can_transition
export -f rag_valid_transitions
export -f rag_stage_ansi
export -f rag_format_stage
