#!/usr/bin/env bash
# =============================================================================
# MAGICFIND DOCTOR - Diagnostic checks for magicfind
# =============================================================================

# Check if LLM backend is ready
_magicfind_check_llm() {
    local verbose="${1:-false}"
    local status=0

    # Check qa module
    if ! declare -f qq &>/dev/null; then
        if declare -f tetra_load_module &>/dev/null; then
            tetra_load_module "qa" 2>/dev/null
        fi
    fi

    if ! declare -f qq &>/dev/null; then
        $verbose && echo "  !! qq function not available"
        return 1
    fi
    $verbose && echo "  ok qq function available"

    # Check API key (qa module stores in QA_DIR/api_key)
    local qa_dir="${QA_DIR:-${TETRA_DIR:-$HOME/tetra}/qa}"
    local api_file="$qa_dir/api_key"

    if [[ ! -f "$api_file" ]]; then
        $verbose && echo "  !! API key file missing: $api_file"
        $verbose && echo "     Run: qa config apikey <your-key>"
        return 1
    fi

    local api_key
    api_key=$(<"$api_file" 2>/dev/null)
    if [[ -z "$api_key" ]]; then
        $verbose && echo "  !! API key file empty: $api_file"
        return 1
    fi

    if [[ ${#api_key} -lt 20 ]]; then
        $verbose && echo "  !! API key seems too short (${#api_key} chars)"
        return 1
    fi

    local masked="${api_key:0:7}...${api_key: -4}"
    $verbose && echo "  ok API key configured ($masked)"

    return 0
}

# Check database directory
_magicfind_check_db() {
    local verbose="${1:-false}"

    local db_dir="$MAGICFIND_DIR/db"

    if [[ ! -d "$db_dir" ]]; then
        $verbose && echo "  !! Database directory missing: $db_dir"
        if mkdir -p "$db_dir" 2>/dev/null; then
            $verbose && echo "     Created: $db_dir"
        else
            $verbose && echo "     Failed to create directory"
            return 1
        fi
    fi

    if [[ ! -w "$db_dir" ]]; then
        $verbose && echo "  !! Database directory not writable: $db_dir"
        return 1
    fi

    local count=$(ls "$db_dir"/*.query 2>/dev/null | wc -l | tr -d ' ')
    $verbose && echo "  ok Database: $db_dir ($count queries)"

    return 0
}

# Check scanspecs
_magicfind_check_specs() {
    local verbose="${1:-false}"

    if [[ ! -d "$SCANSPEC_DIR" ]]; then
        $verbose && echo "  !! Specs directory missing: $SCANSPEC_DIR"
        return 1
    fi

    local count=$(ls "$SCANSPEC_DIR"/*.scanspec 2>/dev/null | wc -l | tr -d ' ')
    if [[ "$count" -eq 0 ]]; then
        $verbose && echo "  -- No scanspecs defined"
    else
        $verbose && echo "  ok Scanspecs: $count available"
    fi

    return 0
}

# Check rules
_magicfind_check_rules() {
    local verbose="${1:-false}"

    local rules_file="$MAGICFIND_DIR/config/rules"

    if [[ ! -f "$rules_file" ]]; then
        $verbose && echo "  -- No rules file (will use defaults)"
        return 0
    fi

    local count=$(grep -c . "$rules_file" 2>/dev/null || echo 0)
    $verbose && echo "  ok Rules: $count defined"

    return 0
}

# Pre-flight check before LLM query (silent, returns status)
_magicfind_preflight() {
    # Quick check: is qq available and API key set?
    if ! declare -f qq &>/dev/null; then
        if declare -f tetra_load_module &>/dev/null; then
            tetra_load_module "qa" 2>/dev/null
        fi
        declare -f qq &>/dev/null || return 1
    fi

    # Check API key exists and is not empty
    local qa_dir="${QA_DIR:-${TETRA_DIR:-$HOME/tetra}/qa}"
    local api_file="$qa_dir/api_key"
    [[ -f "$api_file" ]] || return 1

    local api_key
    api_key=$(<"$api_file" 2>/dev/null)
    [[ -n "$api_key" && ${#api_key} -ge 20 ]] || return 1

    return 0
}

# Main doctor command
_magicfind_doctor() {
    echo "magicfind doctor - System diagnostics"
    echo "======================================"
    echo ""

    local all_ok=true

    echo "Directories:"
    echo "  MAGICFIND_SRC: ${MAGICFIND_SRC:-not set}"
    echo "  MAGICFIND_DIR: ${MAGICFIND_DIR:-not set}"
    echo ""

    echo "LLM Backend:"
    if ! _magicfind_check_llm true; then
        all_ok=false
    fi
    echo ""

    echo "Database:"
    if ! _magicfind_check_db true; then
        all_ok=false
    fi
    echo ""

    echo "Scanspecs:"
    _magicfind_check_specs true
    echo ""

    echo "Rules:"
    _magicfind_check_rules true
    echo ""

    # Quick connectivity test
    echo "Connectivity:"
    if _magicfind_preflight; then
        echo "  ok Pre-flight checks passed"

        # Optional: test actual API call
        if [[ "${1:-}" == "--test" ]]; then
            echo "  .. Testing LLM query..."
            local result
            result=$(qq "respond with just the word: ok" 2>&1)
            if [[ "$result" == *"ok"* ]] || [[ "$result" == *"OK"* ]]; then
                echo "  ok LLM responded correctly"
            else
                echo "  !! LLM test failed: $result"
                all_ok=false
            fi
        fi
    else
        echo "  !! Pre-flight checks failed"
        all_ok=false
    fi
    echo ""

    echo "======================================"
    if $all_ok; then
        echo "Status: READY"
        echo ""
        echo "Quick start:"
        echo "  magicfind 'find all python files'"
        echo "  magicfind spec list"
        return 0
    else
        echo "Status: ISSUES FOUND"
        echo ""
        echo "To fix:"
        echo "  1. Set API key: qa config apikey <your-openai-key>"
        echo "  2. Or use scanspecs: magicfind spec <name>"
        return 1
    fi
}

export -f _magicfind_check_llm _magicfind_check_db _magicfind_check_specs
export -f _magicfind_check_rules _magicfind_preflight _magicfind_doctor
