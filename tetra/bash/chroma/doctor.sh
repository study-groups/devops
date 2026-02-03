#!/usr/bin/env bash

# Chroma Doctor
# Health checks and diagnostics for chroma

#==============================================================================
# MAIN DOCTOR COMMAND
#==============================================================================

chroma_doctor() {
    local verbose=0
    local check_filter=""

    # Parse args
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -v|--verbose) verbose=1; shift ;;
            --check) check_filter="$2"; shift 2 ;;
            -h|--help)
                cat <<'EOF'
Chroma Doctor - Health diagnostics

Usage: chroma doctor [OPTIONS]

Options:
  -v, --verbose     Show detailed output
  --check NAME      Run specific check only
  -h, --help        Show this help

Checks:
  dependencies      Core dependencies (TETRA_SRC, bash version)
  tds               TDS integration and functions
  parsers           Parser registration and validation
  themes            Theme system availability
  tokens            Semantic token resolution

Examples:
  chroma doctor              Run all checks
  chroma doctor -v           Verbose output
  chroma doctor --check tds  Check TDS only
EOF
                return 0
                ;;
            *) shift ;;
        esac
    done

    local exit_code=0

    echo "Chroma Health Check"
    echo "==================="
    echo

    # Run checks
    if [[ -z "$check_filter" || "$check_filter" == "dependencies" ]]; then
        _chroma_doctor_dependencies $verbose || exit_code=1
        echo
    fi

    if [[ -z "$check_filter" || "$check_filter" == "tds" ]]; then
        _chroma_doctor_tds $verbose || exit_code=1
        echo
    fi

    if [[ -z "$check_filter" || "$check_filter" == "parsers" ]]; then
        _chroma_doctor_parsers $verbose || exit_code=1
        echo
    fi

    if [[ -z "$check_filter" || "$check_filter" == "themes" ]]; then
        _chroma_doctor_themes $verbose || exit_code=1
        echo
    fi

    if [[ -z "$check_filter" || "$check_filter" == "tokens" ]]; then
        _chroma_doctor_tokens $verbose || exit_code=1
        echo
    fi

    # Summary
    echo "==================="
    if [[ $exit_code -eq 0 ]]; then
        printf "\033[32m✓ All checks passed\033[0m\n"
    else
        printf "\033[31m✗ Some checks failed\033[0m\n"
    fi

    return $exit_code
}

#==============================================================================
# INDIVIDUAL CHECKS
#==============================================================================

_chroma_doctor_dependencies() {
    local verbose="${1:-0}"
    local ok=0

    echo "Dependencies:"

    # TETRA_SRC
    if [[ -n "$TETRA_SRC" ]]; then
        printf "  \033[32m✓\033[0m TETRA_SRC: %s\n" "$TETRA_SRC"
    else
        printf "  \033[31m✗\033[0m TETRA_SRC not set\n"
        ok=1
    fi

    # CHROMA_SRC
    if [[ -n "$CHROMA_SRC" ]]; then
        printf "  \033[32m✓\033[0m CHROMA_SRC: %s\n" "$CHROMA_SRC"
    else
        printf "  \033[31m✗\033[0m CHROMA_SRC not set\n"
        ok=1
    fi

    # Bash version
    local bash_ver="${BASH_VERSINFO[0]}.${BASH_VERSINFO[1]}"
    if [[ "${BASH_VERSINFO[0]}" -ge 5 ]]; then
        printf "  \033[32m✓\033[0m Bash %s\n" "$bash_ver"
    else
        printf "  \033[31m✗\033[0m Bash %s (requires 5.0+)\n" "$bash_ver"
        ok=1
    fi

    # Terminal
    if [[ -n "$TERM" ]]; then
        printf "  \033[32m✓\033[0m TERM: %s\n" "$TERM"
    else
        printf "  \033[33m·\033[0m TERM not set\n"
    fi

    return $ok
}

_chroma_doctor_tds() {
    local verbose="${1:-0}"
    local ok=0

    echo "TDS Integration:"

    # TDS loaded flag
    if [[ "$TDS_LOADED" == "true" ]]; then
        printf "  \033[32m✓\033[0m TDS loaded"
        [[ -n "$TDS_VERSION" ]] && printf " (v%s)" "$TDS_VERSION"
        echo
    else
        printf "  \033[31m✗\033[0m TDS not loaded\n"
        return 1
    fi

    # Core TDS functions
    local required_fns=(
        tds_text_color
        tds_render_markdown
        tds_switch_theme
        reset_color
    )

    for fn in "${required_fns[@]}"; do
        if declare -F "$fn" &>/dev/null; then
            (( verbose )) && printf "  \033[32m✓\033[0m %s\n" "$fn"
        else
            printf "  \033[31m✗\033[0m %s missing\n" "$fn"
            ok=1
        fi
    done

    (( ! verbose )) && (( ok == 0 )) && \
        printf "  \033[32m✓\033[0m Core functions (%d)\n" "${#required_fns[@]}"

    return $ok
}

_chroma_doctor_parsers() {
    local verbose="${1:-0}"
    local ok=0

    echo "Parsers:"

    if [[ ${#CHROMA_PARSER_ORDER[@]} -eq 0 ]]; then
        printf "  \033[31m✗\033[0m No parsers registered\n"
        return 1
    fi

    for name in "${CHROMA_PARSER_ORDER[@]}"; do
        local fn="${CHROMA_PARSERS[$name]}"
        local validate_fn="${fn}_validate"

        # Check render function exists
        if ! declare -F "$fn" &>/dev/null; then
            printf "  \033[31m✗\033[0m %s (function missing)\n" "$name"
            ok=1
            continue
        fi

        # Run validator if exists
        if declare -F "$validate_fn" &>/dev/null; then
            if "$validate_fn" 2>/dev/null; then
                printf "  \033[32m✓\033[0m %s\n" "$name"
            else
                printf "  \033[31m✗\033[0m %s (validation failed)\n" "$name"
                ok=1
            fi
        else
            printf "  \033[32m✓\033[0m %s (no validator)\n" "$name"
        fi

        # Show extensions in verbose mode
        if (( verbose )); then
            for ext in "${!CHROMA_EXT_MAP[@]}"; do
                [[ "${CHROMA_EXT_MAP[$ext]}" == "$name" ]] && \
                    printf "      .%s\n" "$ext"
            done
        fi
    done

    return $ok
}

_chroma_doctor_themes() {
    local verbose="${1:-0}"
    local ok=0

    echo "Themes:"

    # Active theme
    if [[ -n "$TDS_ACTIVE_THEME" ]]; then
        printf "  \033[32m✓\033[0m Active: %s\n" "$TDS_ACTIVE_THEME"
    else
        printf "  \033[33m·\033[0m No active theme\n"
    fi

    # Theme registry
    if declare -p TDS_THEME_REGISTRY &>/dev/null; then
        local count=${#TDS_THEME_REGISTRY[@]}
        printf "  \033[32m✓\033[0m %d themes available\n" "$count"

        if (( verbose )); then
            for theme in "${!TDS_THEME_REGISTRY[@]}"; do
                local marker=" "
                [[ "$theme" == "$TDS_ACTIVE_THEME" ]] && marker="*"
                printf "      %s %s\n" "$marker" "$theme"
            done
        fi
    else
        printf "  \033[31m✗\033[0m Theme registry not found\n"
        ok=1
    fi

    # Test theme switching
    if declare -F tds_switch_theme &>/dev/null; then
        local current="$TDS_ACTIVE_THEME"
        if TDS_QUIET_LOAD=1 tds_switch_theme "default" 2>/dev/null; then
            TDS_QUIET_LOAD=1 tds_switch_theme "$current" 2>/dev/null
            printf "  \033[32m✓\033[0m Theme switching works\n"
        else
            printf "  \033[31m✗\033[0m Theme switching broken\n"
            ok=1
        fi
    fi

    return $ok
}

_chroma_doctor_tokens() {
    local verbose="${1:-0}"
    local ok=0

    echo "Tokens:"

    # Test critical semantic tokens
    local test_tokens=(
        "text.primary"
        "text.secondary"
        "content.heading.h1"
        "content.code.inline"
        "content.emphasis.bold"
        "content.link"
    )

    local passed=0
    local failed=0

    for token in "${test_tokens[@]}"; do
        # Try to resolve token (capture any output)
        if tds_text_color "$token" &>/dev/null; then
            (( passed++ ))
            (( verbose )) && printf "  \033[32m✓\033[0m %s\n" "$token"
        else
            (( failed++ ))
            printf "  \033[31m✗\033[0m %s (resolution failed)\n" "$token"
            ok=1
        fi
    done

    (( ! verbose )) && (( failed == 0 )) && \
        printf "  \033[32m✓\033[0m %d tokens resolved\n" "$passed"

    return $ok
}

#==============================================================================
# QUICK STATUS
#==============================================================================

# Quick one-line status
chroma_status() {
    local issues=0

    [[ "$TDS_LOADED" != "true" ]] && (( issues++ ))
    [[ ${#CHROMA_PARSER_ORDER[@]} -eq 0 ]] && (( issues++ ))
    [[ -z "$TDS_ACTIVE_THEME" ]] && (( issues++ ))

    if [[ $issues -eq 0 ]]; then
        printf "chroma: \033[32mhealthy\033[0m"
        printf " | parsers:%d" "${#CHROMA_PARSER_ORDER[@]}"
        printf " | theme:%s" "$TDS_ACTIVE_THEME"
        echo
    else
        printf "chroma: \033[31m%d issue(s)\033[0m - run 'chroma doctor'\n" "$issues"
    fi
}

# Functions are local - no exports (TETRA convention)
