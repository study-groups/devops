#!/usr/bin/env bash
# gamepak/core/inspect.sh - Index.html analysis

# =============================================================================
# GAME TYPE DETECTION
# =============================================================================

# Detect game engine/framework from index.html
# Returns: canvas|webgl|phaser|unity|construct|godot|pixi|ruffle|iframe|unknown
_gamepak_detect_type() {
    local html_file="$1"
    local content
    content=$(cat "$html_file" 2>/dev/null)

    # Check in order of specificity
    if echo "$content" | grep -qiE 'UnityLoader|unityInstance|UnityProgress'; then
        echo "unity"
    elif echo "$content" | grep -qiE 'c2runtime|c3runtime|construct'; then
        echo "construct"
    elif echo "$content" | grep -qiE 'godot|GDJS'; then
        echo "godot"
    elif echo "$content" | grep -qiE 'phaser'; then
        echo "phaser"
    elif echo "$content" | grep -qiE 'PIXI|pixi\.js'; then
        echo "pixi"
    elif echo "$content" | grep -qiE 'ruffle|swfobject|\.swf'; then
        echo "ruffle"
    elif echo "$content" | grep -qiE 'webgl|three\.js|babylon|WebGLRenderer'; then
        echo "webgl"
    elif echo "$content" | grep -qiE '<canvas'; then
        echo "canvas"
    elif echo "$content" | grep -qiE '<iframe'; then
        echo "iframe"
    else
        echo "unknown"
    fi
}

# =============================================================================
# SDK DETECTION
# =============================================================================

# Check for PJA SDK presence and version
# Returns: "present (vX.Y.Z)" or "missing"
_gamepak_detect_sdk() {
    local html_file="$1"
    local content
    content=$(cat "$html_file" 2>/dev/null)

    # Check for SDK markers
    if echo "$content" | grep -qiE 'pjaSdk|pjaGameSdk|window\.PJA|PJA\.init|pja-sdk'; then
        # Try to extract version
        local version
        version=$(echo "$content" | grep -oE 'PJA.version\s*=\s*["\x27][^"\x27]+["\x27]' | \
            head -1 | sed "s/.*[\"']\([^\"']*\)[\"'].*/\1/")

        if [[ -n "$version" ]]; then
            echo "present (v$version)"
        else
            echo "present"
        fi
    else
        echo "missing"
    fi
}

# =============================================================================
# CSS ANALYSIS
# =============================================================================

# Check CSS for iframe compatibility issues
# Returns list of issues, one per line
_gamepak_check_css() {
    local html_file="$1"
    local content
    content=$(cat "$html_file" 2>/dev/null)
    local issues=()

    # Check viewport meta
    if ! echo "$content" | grep -qiE '<meta[^>]*viewport'; then
        issues+=("no-viewport: Missing <meta name=\"viewport\"> tag")
    fi

    # Check body margin/padding
    if ! echo "$content" | grep -qiE 'body[^{]*\{[^}]*margin\s*:\s*0'; then
        issues+=("body-margin: Body may have default margin")
    fi

    # Check overflow hidden
    if ! echo "$content" | grep -qiE 'overflow\s*:\s*hidden'; then
        issues+=("no-overflow-hidden: No overflow:hidden (may show scrollbars)")
    fi

    # Check height 100%
    if ! echo "$content" | grep -qiE 'height\s*:\s*100%'; then
        issues+=("no-height-100: No height:100% on html/body")
    fi

    # Output issues
    if ((${#issues[@]} == 0)); then
        echo "ok"
    else
        printf '%s\n' "${issues[@]}"
    fi
}

# =============================================================================
# MAIN INSPECT COMMAND
# =============================================================================

gamepak_inspect() {
    local dir="."
    local mode="full"  # full, type, sdk, css
    local html_file=""

    # Parse options
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --type|-t) mode="type" ;;
            --sdk|-s) mode="sdk" ;;
            --css|-c) mode="css" ;;
            --file|-f) html_file="$2"; shift ;;
            -*) echo "Unknown option: $1" >&2; return 1 ;;
            *) dir="$1" ;;
        esac
        shift
    done

    # Resolve directory
    [[ "$dir" != /* ]] && dir="$(cd "$dir" 2>/dev/null && pwd)"

    # Find index.html
    if [[ -z "$html_file" ]]; then
        if [[ -f "$dir/index.html" ]]; then
            html_file="$dir/index.html"
        elif [[ -f "$dir" ]]; then
            html_file="$dir"
            dir=$(dirname "$html_file")
        else
            echo "No index.html found in $dir" >&2
            return 1
        fi
    fi

    # Single-mode output
    case "$mode" in
        type)
            _gamepak_detect_type "$html_file"
            return
            ;;
        sdk)
            _gamepak_detect_sdk "$html_file"
            return
            ;;
        css)
            _gamepak_check_css "$html_file"
            return
            ;;
    esac

    # Full inspection
    local size=$(wc -c < "$html_file" | tr -d ' ')
    local lines=$(wc -l < "$html_file" | tr -d ' ')
    local game_type=$(_gamepak_detect_type "$html_file")
    local sdk_status=$(_gamepak_detect_sdk "$html_file")
    local css_issues=$(_gamepak_check_css "$html_file")

    echo "Gamepak Inspect"
    echo "==============="
    echo ""
    echo "File:    $html_file"
    echo "Size:    $size bytes ($lines lines)"
    echo ""
    echo "Type:    $game_type"
    echo "SDK:     $sdk_status"
    echo ""
    echo "CSS Checks:"

    if [[ "$css_issues" == "ok" ]]; then
        echo "  [OK] All checks passed"
    else
        while IFS= read -r issue; do
            local code="${issue%%:*}"
            local desc="${issue#*: }"
            echo "  [WARN] $desc"
        done <<< "$css_issues"
    fi

    # Show recommendations
    echo ""
    if [[ "$sdk_status" == "missing" ]] || [[ "$css_issues" != "ok" ]]; then
        echo "Issues found. Run: gamepak doctor --fix"
    else
        echo "No issues found."
    fi
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f _gamepak_detect_type _gamepak_detect_sdk _gamepak_check_css
export -f gamepak_inspect
