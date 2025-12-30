#!/usr/bin/env bash

# TDS Pattern Registry
# Data-driven pattern-to-token colorization system
#
# The "tetra way": provide clean text, apply color via pattern matching
#
# Usage:
#   token=$(tds_pattern_match "feat" "commit")
#   tds_text_color "$token"
#   printf '%s' "feat"
#   reset_color

# =============================================================================
# PATTERN REGISTRY
# =============================================================================

# Pattern categories - each maps regex patterns to semantic tokens
# Format: pattern -> token
# Patterns are matched in order; first match wins

declare -gA TDS_PATTERNS_COMMIT=(
    # Conventional commit types
    ["feat"]="status.success"           # Green - new feature
    ["fix"]="status.warning"            # Orange - bug fix
    ["refactor"]="status.info"          # Blue - code restructure
    ["docs"]="action.focus"             # Purple - documentation
    ["test"]="structural.primary"       # Teal - testing
    ["perf"]="status.success"           # Green - performance
    ["style"]="text.tertiary"           # Dim - formatting only
    ["chore"]="text.muted"              # Muted - maintenance
    ["ci"]="text.disabled"              # Dimmer - CI/CD
    ["build"]="text.disabled"           # Dimmer - build system
    ["revert"]="status.error"           # Red - reverting changes
    ["wip"]="text.muted"                # Muted - work in progress
    ["merge"]="action.secondary"        # Secondary - merge commits
)

declare -gA TDS_PATTERNS_LOG=(
    # Log levels
    ["ERROR"]="status.error"
    ["FATAL"]="status.error"
    ["WARN"]="status.warning"
    ["WARNING"]="status.warning"
    ["INFO"]="status.info"
    ["DEBUG"]="text.muted"
    ["TRACE"]="text.disabled"
    ["SUCCESS"]="status.success"
    ["OK"]="status.success"
    ["FAIL"]="status.error"
    ["PASS"]="status.success"
)

declare -gA TDS_PATTERNS_STATUS=(
    # Process/service status
    ["running"]="status.success"
    ["active"]="status.success"
    ["started"]="status.success"
    ["online"]="status.success"
    ["connected"]="status.success"
    ["stopped"]="status.warning"
    ["inactive"]="text.muted"
    ["pending"]="status.warning"
    ["waiting"]="status.warning"
    ["failed"]="status.error"
    ["error"]="status.error"
    ["dead"]="status.error"
    ["crashed"]="status.error"
    ["unknown"]="text.disabled"
)

declare -gA TDS_PATTERNS_FILE=(
    # File extensions/types
    ["*.sh"]="action.secondary"         # Scripts - orange
    ["*.bash"]="action.secondary"
    ["*.zsh"]="action.secondary"
    ["*.md"]="structural.primary"       # Docs - teal
    ["*.txt"]="text.primary"
    ["*.json"]="action.focus"           # Config - purple
    ["*.yaml"]="action.focus"
    ["*.yml"]="action.focus"
    ["*.toml"]="action.focus"
    ["*.conf"]="action.focus"
    ["*.js"]="status.warning"           # JS - yellow/orange
    ["*.ts"]="status.info"              # TS - blue
    ["*.py"]="status.info"              # Python - blue
    ["*.go"]="structural.primary"       # Go - teal
    ["*.rs"]="status.warning"           # Rust - orange
    ["*.c"]="text.primary"
    ["*.h"]="text.secondary"
    ["*.css"]="action.focus"
    ["*.html"]="status.warning"
)

declare -gA TDS_PATTERNS_GIT=(
    # Git refs and status
    ["HEAD"]="status.error"             # Red - current position
    ["main"]="status.success"           # Green - main branch
    ["master"]="status.success"
    ["origin/*"]="status.warning"       # Orange - remote
    ["tag:*"]="action.focus"            # Purple - tags
    ["staged"]="status.success"
    ["modified"]="status.warning"
    ["untracked"]="status.warning"
    ["clean"]="text.muted"
)

declare -gA TDS_PATTERNS_ENV=(
    # Environment indicators
    ["prod"]="status.error"             # Red - production (caution!)
    ["production"]="status.error"
    ["staging"]="status.warning"        # Orange - staging
    ["stage"]="status.warning"
    ["dev"]="status.success"            # Green - development
    ["development"]="status.success"
    ["local"]="structural.primary"      # Teal - local
    ["test"]="status.info"              # Blue - testing
    ["qa"]="status.info"
)

declare -gA TDS_PATTERNS_PRIORITY=(
    # Priority/severity
    ["critical"]="status.error"
    ["high"]="status.error"
    ["urgent"]="status.error"
    ["medium"]="status.warning"
    ["normal"]="text.primary"
    ["low"]="text.muted"
    ["minor"]="text.disabled"
)

# =============================================================================
# PATTERN MATCHING FUNCTIONS
# =============================================================================

# Get the pattern array name for a category
_tds_pattern_array_name() {
    local category="$1"
    case "$category" in
        commit|commits)   echo "TDS_PATTERNS_COMMIT" ;;
        log|logs)         echo "TDS_PATTERNS_LOG" ;;
        status)           echo "TDS_PATTERNS_STATUS" ;;
        file|files)       echo "TDS_PATTERNS_FILE" ;;
        git)              echo "TDS_PATTERNS_GIT" ;;
        env|environment)  echo "TDS_PATTERNS_ENV" ;;
        priority)         echo "TDS_PATTERNS_PRIORITY" ;;
        *)                echo "" ;;
    esac
}

# Match text against patterns in a category
# Returns the semantic token for the first matching pattern
# Usage: token=$(tds_pattern_match "feat" "commit")
tds_pattern_match() {
    local text="$1"
    local category="${2:-commit}"
    local array_name=$(_tds_pattern_array_name "$category")

    [[ -z "$array_name" ]] && { echo "text.primary"; return 1; }

    # Get reference to the pattern array
    local -n patterns="$array_name"

    # Try exact match first (case-insensitive)
    local lower_text="${text,,}"
    for pattern in "${!patterns[@]}"; do
        local lower_pattern="${pattern,,}"
        if [[ "$lower_text" == "$lower_pattern" ]]; then
            echo "${patterns[$pattern]}"
            return 0
        fi
    done

    # Try prefix match
    for pattern in "${!patterns[@]}"; do
        local lower_pattern="${pattern,,}"
        if [[ "$lower_text" == "$lower_pattern"* ]]; then
            echo "${patterns[$pattern]}"
            return 0
        fi
    done

    # Try glob match (for patterns like "*.sh" or "origin/*")
    for pattern in "${!patterns[@]}"; do
        # shellcheck disable=SC2053
        if [[ "$text" == $pattern ]]; then
            echo "${patterns[$pattern]}"
            return 0
        fi
    done

    echo "text.primary"
    return 1
}

# Match and colorize text in one call
# Usage: tds_pattern_colorize "feat" "commit"
tds_pattern_colorize() {
    local text="$1"
    local category="${2:-commit}"
    local token

    token=$(tds_pattern_match "$text" "$category")

    # Try to apply color
    if declare -F text_color &>/dev/null; then
        local hex=$(_tds_token_to_hex "$token")
        text_color "$hex"
        printf '%s' "$text"
        reset_color
    else
        printf '%s' "$text"
    fi
}

# Resolve semantic token to hex color using actual palette arrays
# This bypasses the broken token system and uses palettes directly
_tds_token_to_hex() {
    local token="$1"

    # Map tokens to palette positions
    case "$token" in
        # Status tokens -> SEMANTIC palette
        status.success|success)  echo "${SEMANTIC[2]:-43A047}" ;;
        status.warning|warning)  echo "${SEMANTIC[1]:-FB8C00}" ;;
        status.error|error)      echo "${SEMANTIC[0]:-E53935}" ;;
        status.info|info)        echo "${SEMANTIC[3]:-1E88E5}" ;;

        # Action tokens -> SECONDARY palette
        action.primary)          echo "${SECONDARY[0]:-1E88E5}" ;;
        action.secondary)        echo "${SECONDARY[1]:-FB8C00}" ;;
        action.focus)            echo "${SECONDARY[6]:-8E24AA}" ;;

        # Text tokens -> SURFACE palette
        text.primary)            echo "${SURFACE[7]:-E9EAEB}" ;;
        text.secondary)          echo "${SURFACE[6]:-C9CACE}" ;;
        text.tertiary)           echo "${SURFACE[5]:-A9ABB1}" ;;
        text.muted)              echo "${SURFACE[4]:-898C94}" ;;
        text.disabled|text.dim)  echo "${SURFACE[3]:-6A6D75}" ;;

        # Structural tokens -> PRIMARY palette
        structural.primary)      echo "${PRIMARY[4]:-00ACC1}" ;;

        # Default fallback
        *)                       echo "${SURFACE[7]:-C0CAF5}" ;;
    esac
}

# List all patterns in a category
# Usage: tds_pattern_list "commit"
tds_pattern_list() {
    local category="${1:-commit}"
    local array_name=$(_tds_pattern_array_name "$category")

    [[ -z "$array_name" ]] && { echo "Unknown category: $category" >&2; return 1; }

    local -n patterns="$array_name"

    printf "Patterns for category '%s':\n" "$category"
    for pattern in "${!patterns[@]}"; do
        printf "  %-20s -> %s\n" "$pattern" "${patterns[$pattern]}"
    done | sort
}

# List all categories
tds_pattern_categories() {
    echo "Available pattern categories:"
    echo "  commit    - Conventional commit types (feat, fix, refactor...)"
    echo "  log       - Log levels (ERROR, WARN, INFO...)"
    echo "  status    - Process status (running, stopped, failed...)"
    echo "  file      - File extensions (*.sh, *.md, *.json...)"
    echo "  git       - Git refs and status (HEAD, main, origin/...)"
    echo "  env       - Environment names (prod, staging, dev...)"
    echo "  priority  - Priority levels (critical, high, medium...)"
}

# =============================================================================
# CUSTOM PATTERN REGISTRATION
# =============================================================================

# User-defined patterns (loaded from config)
declare -gA TDS_PATTERNS_CUSTOM=()

# Register a custom pattern
# Usage: tds_pattern_register "TODO" "status.warning" "custom"
tds_pattern_register() {
    local pattern="$1"
    local token="$2"
    local category="${3:-custom}"

    if [[ "$category" == "custom" ]]; then
        TDS_PATTERNS_CUSTOM["$pattern"]="$token"
    else
        local array_name=$(_tds_pattern_array_name "$category")
        if [[ -n "$array_name" ]]; then
            local -n patterns="$array_name"
            patterns["$pattern"]="$token"
        fi
    fi
}

# Load custom patterns from config file
# Format: pattern|token|category (one per line)
tds_pattern_load_config() {
    local config_file="${1:-${TETRA_DIR:-$HOME/tetra}/config/patterns.conf}"

    [[ ! -f "$config_file" ]] && return 0

    while IFS='|' read -r pattern token category; do
        [[ -z "$pattern" || "$pattern" == \#* ]] && continue
        tds_pattern_register "$pattern" "$token" "${category:-custom}"
    done < "$config_file"
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f tds_pattern_match
export -f tds_pattern_colorize
export -f tds_pattern_list
export -f tds_pattern_categories
export -f tds_pattern_register
export -f tds_pattern_load_config
