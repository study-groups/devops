#!/usr/bin/env bash

# Games Preflight Module - Deploy-readiness validation
#
# Validates that a game is ready for deployment by checking:
#   1. SDK presence (pja-sdk.js loaded in index.html)
#   2. Lifecycle handlers (START, STOP, PAUSE)
#   3. Volume handler (VOLUME)
#   4. Required files exist
#
# Usage:
#   games preflight <game>           Validate a single game
#   games preflight --all            Validate all games in org
#   games preflight <game> --json    Machine-readable output

# Require bash 5.2+
if ((BASH_VERSINFO[0] < 5 || (BASH_VERSINFO[0] == 5 && BASH_VERSINFO[1] < 2))); then
    echo "Error: games_preflight requires bash 5.2+" >&2
    return 1
fi

# =============================================================================
# CONSTANTS
# =============================================================================

# Required PJA SDK callbacks that games must implement
readonly PREFLIGHT_LIFECYCLE_HANDLERS=(
    "onStart"
    "onStop"
    "onPause"
)

readonly PREFLIGHT_VOLUME_HANDLERS=(
    "onVolumeChange"
)

# SDK script patterns to look for in HTML
readonly PREFLIGHT_SDK_PATTERNS=(
    'pja-sdk.js'
    'pja-sdk.min.js'
    '/lib/pja-sdk'
    'cabinet/lib/pja-sdk'
)

# =============================================================================
# PREFLIGHT CHECK FUNCTIONS
# =============================================================================

# Check if SDK is loaded in index.html
# Returns: 0 if found, 1 if not
_preflight_check_sdk() {
    local game_dir="$1"
    local index_file="${game_dir}/index.html"

    if [[ ! -f "$index_file" ]]; then
        echo "missing"
        return 1
    fi

    local content
    content=$(<"$index_file")

    for pattern in "${PREFLIGHT_SDK_PATTERNS[@]}"; do
        if [[ "$content" == *"$pattern"* ]]; then
            echo "found:$pattern"
            return 0
        fi
    done

    # Also check for inline PJA initialization
    if [[ "$content" == *"window.PJA"* ]] || [[ "$content" == *"PJA.ready"* ]]; then
        echo "found:inline"
        return 0
    fi

    echo "not-found"
    return 1
}

# Check if lifecycle handlers are implemented
# Searches all JS files in game directory
_preflight_check_handlers() {
    local game_dir="$1"
    local -n handlers_ref="$2"
    local -a missing=()
    local -a found=()

    # Concatenate all JS content for searching
    local js_content=""
    while IFS= read -r -d '' jsfile; do
        js_content+=$(<"$jsfile")
    done < <(find "$game_dir" -name "*.js" -type f -print0 2>/dev/null)

    # Also check inline scripts in HTML
    if [[ -f "${game_dir}/index.html" ]]; then
        js_content+=$(<"${game_dir}/index.html")
    fi

    for handler in "${handlers_ref[@]}"; do
        # Match patterns like:
        #   PJA.onStart =
        #   onStart:
        #   "onStart":
        #   'onStart':
        local pattern="(PJA\\.${handler}\\s*=|['\"]?${handler}['\"]?\\s*:)"

        if echo "$js_content" | grep -qE "$pattern"; then
            found+=("$handler")
        else
            missing+=("$handler")
        fi
    done

    # Output results
    if [[ ${#missing[@]} -eq 0 ]]; then
        echo "ok"
        return 0
    else
        echo "missing:${missing[*]}"
        return 1
    fi
}

# Check required files exist
_preflight_check_files() {
    local game_dir="$1"
    local -a missing=()

    # Required files
    local -a required=("index.html")

    # Recommended files
    local -a recommended=("game.toml")

    for file in "${required[@]}"; do
        if [[ ! -f "${game_dir}/${file}" ]]; then
            missing+=("$file")
        fi
    done

    if [[ ${#missing[@]} -eq 0 ]]; then
        echo "ok"
        return 0
    else
        echo "missing:${missing[*]}"
        return 1
    fi
}

# Check game.toml has required fields
_preflight_check_toml() {
    local game_dir="$1"
    local toml_file="${game_dir}/game.toml"

    if [[ ! -f "$toml_file" ]]; then
        echo "missing"
        return 1
    fi

    local -a missing=()

    # Check for required fields
    grep -qE '^name\s*=' "$toml_file" || missing+=("name")
    grep -qE '^version\s*=' "$toml_file" || missing+=("version")

    if [[ ${#missing[@]} -eq 0 ]]; then
        echo "ok"
        return 0
    else
        echo "missing:${missing[*]}"
        return 1
    fi
}

# Check if SDK is required for this game
# Returns: "true" if SDK checks should run, "false" to skip
_preflight_sdk_required() {
    local game_dir="$1"
    local toml_file="${game_dir}/game.toml"

    if [[ ! -f "$toml_file" ]]; then
        echo "true"  # Default: SDK required
        return 0
    fi

    # Simple check: look for sdk.required = false anywhere after [sdk] header
    # This works because TOML keys are unique within sections
    if grep -q '^\[sdk\]' "$toml_file" && grep -q '^required *= *false' "$toml_file"; then
        echo "false"
        return 0
    fi

    echo "true"
}

# =============================================================================
# MAIN PREFLIGHT FUNCTION
# =============================================================================

# Run preflight checks on a game
# Usage: games_preflight <game> [--json] [--org <org>]
games_preflight() {
    local game=""
    local org=""
    local json_output=false
    local check_all=false
    local verbose=false

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --json|-j) json_output=true ;;
            --org|-o) org="$2"; shift ;;
            --all|-a) check_all=true ;;
            --verbose|-v) verbose=true ;;
            -*)
                echo "Unknown option: $1" >&2
                return 1
                ;;
            *)
                game="$1"
                ;;
        esac
        shift
    done

    org="${org:-$(_games_get_org)}"
    local games_dir="${TETRA_DIR}/orgs/${org}/games"

    if $check_all; then
        _preflight_all "$games_dir" "$json_output"
        return $?
    fi

    if [[ -z "$game" ]]; then
        echo "Usage: games preflight <game> [--json] [--org <org>]" >&2
        echo "       games preflight --all [--org <org>]" >&2
        return 1
    fi

    local game_dir="${games_dir}/${game}"

    if [[ ! -d "$game_dir" ]]; then
        echo "Game not found: $game" >&2
        echo "Looked in: $game_dir" >&2
        return 1
    fi

    _preflight_single "$game" "$game_dir" "$json_output" "$verbose"
}

# Run preflight on a single game
_preflight_single() {
    local game="$1"
    local game_dir="$2"
    local json_output="$3"
    local verbose="${4:-false}"

    local -A results=()
    local errors=0
    local warnings=0
    local sdk_required=true

    # Check if SDK is required for this game
    [[ "$(_preflight_sdk_required "$game_dir")" == "false" ]] && sdk_required=false

    # 1. Check required files
    results[files]=$(_preflight_check_files "$game_dir")
    [[ "${results[files]}" != "ok" ]] && ((errors++))

    # 2. Check SDK presence (skip if sdk.required = false)
    if $sdk_required; then
        results[sdk]=$(_preflight_check_sdk "$game_dir")
        [[ "${results[sdk]}" == "not-found" || "${results[sdk]}" == "missing" ]] && ((errors++))
    else
        results[sdk]="skipped:legacy"
    fi

    # 3. Check lifecycle handlers (skip if sdk.required = false)
    if $sdk_required; then
        results[lifecycle]=$(_preflight_check_handlers "$game_dir" PREFLIGHT_LIFECYCLE_HANDLERS)
        [[ "${results[lifecycle]}" != "ok" ]] && ((errors++))
    else
        results[lifecycle]="skipped:legacy"
    fi

    # 4. Check volume handlers (skip if sdk.required = false)
    if $sdk_required; then
        results[volume]=$(_preflight_check_handlers "$game_dir" PREFLIGHT_VOLUME_HANDLERS)
        [[ "${results[volume]}" != "ok" ]] && ((warnings++))
    else
        results[volume]="skipped:legacy"
    fi

    # 5. Check game.toml
    results[toml]=$(_preflight_check_toml "$game_dir")
    [[ "${results[toml]}" != "ok" ]] && ((warnings++))

    # Output results
    if $json_output; then
        _preflight_json_output "$game" results "$errors" "$warnings"
    else
        _preflight_text_output "$game" results "$errors" "$warnings"
    fi

    # Return based on errors
    ((errors > 0)) && return 1
    return 0
}

# Text output format
_preflight_text_output() {
    local game="$1"
    local -n res="$2"
    local errors="$3"
    local warnings="$4"

    echo "Preflight: $game"
    echo "$(printf '=%.0s' {1..40})"
    echo ""

    # Files check
    printf "%-25s" "[1] Required files"
    if [[ "${res[files]}" == "ok" ]]; then
        echo "ok"
    else
        echo "FAIL (${res[files]#missing:})"
    fi

    # SDK check
    printf "%-25s" "[2] PJA SDK loaded"
    case "${res[sdk]}" in
        found:*)
            local pattern="${res[sdk]#found:}"
            echo "ok ($pattern)"
            ;;
        skipped:legacy)
            echo "SKIP (sdk.required=false)"
            ;;
        not-found|missing)
            echo "FAIL (SDK not found in index.html)"
            ;;
    esac

    # Lifecycle handlers
    printf "%-25s" "[3] Lifecycle handlers"
    case "${res[lifecycle]}" in
        ok)
            echo "ok (START, STOP, PAUSE)"
            ;;
        skipped:legacy)
            echo "SKIP (sdk.required=false)"
            ;;
        *)
            local missing="${res[lifecycle]#missing:}"
            echo "FAIL (missing: $missing)"
            ;;
    esac

    # Volume handler
    printf "%-25s" "[4] Volume handler"
    case "${res[volume]}" in
        ok)
            echo "ok"
            ;;
        skipped:legacy)
            echo "SKIP (sdk.required=false)"
            ;;
        *)
            echo "WARN (missing onVolumeChange)"
            ;;
    esac

    # game.toml
    printf "%-25s" "[5] game.toml"
    case "${res[toml]}" in
        ok)
            echo "ok"
            ;;
        missing)
            echo "WARN (no game.toml)"
            ;;
        missing:*)
            local fields="${res[toml]#missing:}"
            echo "WARN (missing fields: $fields)"
            ;;
    esac

    # Summary
    echo ""
    echo "---"
    if ((errors == 0)); then
        if ((warnings == 0)); then
            echo "Ready to deploy."
        else
            echo "Ready with $warnings warning(s)."
        fi
    else
        echo "NOT READY: $errors error(s), $warnings warning(s)"
    fi
}

# JSON output format
_preflight_json_output() {
    local game="$1"
    local -n res="$2"
    local errors="$3"
    local warnings="$4"

    local ready="true"
    ((errors > 0)) && ready="false"

    # Build JSON manually (no jq dependency for preflight)
    cat << EOF
{
  "game": "$game",
  "ready": $ready,
  "errors": $errors,
  "warnings": $warnings,
  "checks": {
    "files": {"status": "${res[files]%%:*}", "detail": "${res[files]#*:}"},
    "sdk": {"status": "${res[sdk]%%:*}", "detail": "${res[sdk]#*:}"},
    "lifecycle": {"status": "${res[lifecycle]%%:*}", "detail": "${res[lifecycle]#*:}"},
    "volume": {"status": "${res[volume]%%:*}", "detail": "${res[volume]#*:}"},
    "toml": {"status": "${res[toml]%%:*}", "detail": "${res[toml]#*:}"}
  }
}
EOF
}

# Run preflight on all games
_preflight_all() {
    local games_dir="$1"
    local json_output="$2"

    local total=0
    local passed=0
    local failed=0
    local -a failed_games=()

    if $json_output; then
        echo "["
    else
        echo "Preflight: All games in $(basename "$(dirname "$games_dir")")"
        echo "$(printf '=%.0s' {1..50})"
        echo ""
        printf "%-25s %s\n" "GAME" "STATUS"
        printf "%-25s %s\n" "----" "------"
    fi

    local first=true
    for game_dir in "$games_dir"/*/; do
        [[ -d "$game_dir" ]] || continue
        [[ ! -f "${game_dir}/index.html" ]] && continue  # Skip non-web games

        local game=$(basename "$game_dir")
        ((total++))

        if $json_output; then
            $first || echo ","
            first=false
            _preflight_single "$game" "$game_dir" true 2>/dev/null
        else
            # Quick check
            local result
            if _preflight_single "$game" "$game_dir" false >/dev/null 2>&1; then
                result="ok"
                ((passed++))
            else
                result="FAIL"
                ((failed++))
                failed_games+=("$game")
            fi
            printf "%-25s %s\n" "$game" "$result"
        fi
    done

    if $json_output; then
        echo "]"
    else
        echo ""
        echo "---"
        echo "Total: $total | Passed: $passed | Failed: $failed"

        if ((failed > 0)); then
            echo ""
            echo "Failed games:"
            for g in "${failed_games[@]}"; do
                echo "  - $g"
            done
            echo ""
            echo "Run 'games preflight <game>' for details"
        fi
    fi

    ((failed > 0)) && return 1
    return 0
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f games_preflight
export -f _preflight_check_sdk
export -f _preflight_check_handlers
export -f _preflight_check_files
export -f _preflight_check_toml
export -f _preflight_sdk_required
export -f _preflight_single
export -f _preflight_all
export -f _preflight_text_output
export -f _preflight_json_output
