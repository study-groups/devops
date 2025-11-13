#!/usr/bin/env bash
# TDOCS Constants - Central taxonomy definitions
# Following org pattern of canonical constant arrays

# ============================================================================
# LIFECYCLE STAGES (Replaces Grade)
# ============================================================================

# Lifecycle stages - documents progress through these
declare -ga TDOC_LIFECYCLES=(
    "D"  # Draft - work in progress, unreviewed
    "W"  # Working - functional, active development [DEFAULT]
    "S"  # Stable - proven, reviewed, reliable
    "C"  # Canonical - authoritative, system of record
    "X"  # Archived - superseded, do not use
)

# Lifecycle full names for display
declare -gA TDOC_LIFECYCLE_NAMES=(
    [D]="draft"
    [W]="working"
    [S]="stable"
    [C]="canonical"
    [X]="archived"
)

# Lifecycle ranking multipliers (applied to base type rank)
declare -gA TDOC_LIFECYCLE_MULTIPLIERS=(
    [D]="0.8"    # Draft - slight penalty
    [W]="1.0"    # Working - neutral (DEFAULT)
    [S]="1.3"    # Stable - boost for proven docs
    [C]="1.6"    # Canonical - strong boost for authority
    [X]="0.1"    # Archived - heavy penalty
)

# Lifecycle to evidence weight mapping (for RAG)
declare -gA TDOC_LIFECYCLE_EVIDENCE=(
    [D]="excluded"    # Draft - exclude from RAG
    [W]="tertiary"    # Working - low confidence
    [S]="secondary"   # Stable - medium confidence
    [C]="primary"     # Canonical - high confidence
    [X]="excluded"    # Archived - exclude from RAG
)

# Default lifecycle for new documents
TDOC_DEFAULT_LIFECYCLE="W"

# ============================================================================
# DOCUMENT TYPES (Fixed - never evolve)
# ============================================================================

# All valid document types
declare -ga TDOC_TYPES=(
    # Learn types
    "guide"
    "example"
    "tutorial"
    # Reference types
    "spec"
    "standard"
    "reference"
    # Why types
    "investigation"
    "architecture"
    "explanation"
    # Track types
    "summary"
    "bug-fix"
    "refactor"
    "changelog"
    # Plan types
    "plan"
    "proposal"
    "roadmap"
    # Other
    "scratch"
)

# Type aliases (for backward compatibility and convenience)
declare -gA TDOC_TYPE_ALIASES=(
    [specification]="spec"
    [std]="standard"
    [ref]="reference"
    [arch]="architecture"
    [explain]="explanation"
    [bugfix]="bug-fix"
    [notes]="scratch"
)

# ============================================================================
# DISCOVERY MODES (Task-oriented navigation)
# ============================================================================

# Discovery modes - how users find documents
declare -ga TDOC_DISCOVERY_MODES=(
    "learn"   # Guides, examples, tutorials (how to do X)
    "ref"     # Specs, standards, APIs (what is X)
    "why"     # Investigations, architecture (how/why X works)
    "track"   # Summaries, changes, fixes (what changed)
    "plan"    # Proposals, roadmaps (what should we do)
    "all"     # Everything (no filter)
)

# Type to discovery mode mapping
declare -gA TDOC_TYPE_TO_MODE=(
    # Learn mode
    [guide]="learn"
    [example]="learn"
    [tutorial]="learn"
    # Ref mode
    [spec]="ref"
    [standard]="ref"
    [reference]="ref"
    # Why mode
    [investigation]="why"
    [architecture]="why"
    [explanation]="why"
    # Track mode
    [summary]="track"
    [bug-fix]="track"
    [refactor]="track"
    [changelog]="track"
    # Plan mode
    [plan]="plan"
    [proposal]="plan"
    [roadmap]="plan"
    # Other
    [scratch]="all"
)

# Discovery mode to types mapping (inverse of above)
declare -gA TDOC_MODE_TYPES=(
    [learn]="guide example tutorial"
    [ref]="spec standard reference"
    [why]="investigation architecture explanation"
    [track]="summary bug-fix refactor changelog"
    [plan]="plan proposal roadmap"
    [all]=""  # Empty = no filter
)

# Discovery mode display names
declare -gA TDOC_MODE_NAMES=(
    [learn]="Learn"
    [ref]="Reference"
    [why]="Understand"
    [track]="Track Changes"
    [plan]="Planning"
    [all]="All Documents"
)

# ============================================================================
# TYPE BASE RANKS (for relevance scoring)
# ============================================================================

# Base ranking by type (before lifecycle multiplier)
declare -gA TDOC_TYPE_BASE_RANKS=(
    # Reference types - highest base rank
    [spec]="1.0"
    [standard]="1.0"
    [reference]="1.0"
    # Guide types - medium base rank
    [guide]="0.6"
    [example]="0.6"
    [tutorial]="0.6"
    # Working types - lower base rank
    [investigation]="0.3"
    [architecture]="0.4"
    [explanation]="0.4"
    [summary]="0.3"
    [bug-fix]="0.3"
    [refactor]="0.3"
    [changelog]="0.3"
    [plan]="0.3"
    [proposal]="0.3"
    [roadmap]="0.3"
    # Scratch - minimal rank
    [scratch]="0.1"
)

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

# Get lifecycle full name
tdoc_lifecycle_name() {
    local lifecycle="$1"
    echo "${TDOC_LIFECYCLE_NAMES[$lifecycle]:-unknown}"
}

# Get lifecycle multiplier
tdoc_lifecycle_multiplier() {
    local lifecycle="$1"
    echo "${TDOC_LIFECYCLE_MULTIPLIERS[$lifecycle]:-1.0}"
}

# Get evidence weight for lifecycle
tdoc_lifecycle_evidence() {
    local lifecycle="$1"
    echo "${TDOC_LIFECYCLE_EVIDENCE[$lifecycle]:-tertiary}"
}

# Get discovery mode for type
tdoc_type_mode() {
    local type="$1"
    echo "${TDOC_TYPE_TO_MODE[$type]:-all}"
}

# Get base rank for type
tdoc_type_rank() {
    local type="$1"
    echo "${TDOC_TYPE_BASE_RANKS[$type]:-0.5}"
}

# Resolve type alias
tdoc_resolve_type() {
    local type="$1"
    echo "${TDOC_TYPE_ALIASES[$type]:-$type}"
}

# Validate lifecycle
tdoc_valid_lifecycle() {
    local lifecycle="$1"
    for valid in "${TDOC_LIFECYCLES[@]}"; do
        [[ "$lifecycle" == "$valid" ]] && return 0
    done
    return 1
}

# Validate type
tdoc_valid_type() {
    local type="$1"
    # Check if type is valid or has an alias
    for valid in "${TDOC_TYPES[@]}"; do
        [[ "$type" == "$valid" ]] && return 0
    done
    [[ -n "${TDOC_TYPE_ALIASES[$type]}" ]] && return 0
    return 1
}

# Validate discovery mode
tdoc_valid_mode() {
    local mode="$1"
    for valid in "${TDOC_DISCOVERY_MODES[@]}"; do
        [[ "$mode" == "$valid" ]] && return 0
    done
    return 1
}

# Export all functions
export -f tdoc_lifecycle_name
export -f tdoc_lifecycle_multiplier
export -f tdoc_lifecycle_evidence
export -f tdoc_type_mode
export -f tdoc_type_rank
export -f tdoc_resolve_type
export -f tdoc_valid_lifecycle
export -f tdoc_valid_type
export -f tdoc_valid_mode
