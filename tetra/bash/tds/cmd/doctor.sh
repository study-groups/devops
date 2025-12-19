#!/usr/bin/env bash
# TDS Doctor - Health check and diagnostics

_tds_cmd_doctor() {
    local label_width=18

    echo
    echo "=== TDS Doctor ==="
    echo

    local tds_src="${TDS_SRC:-$TETRA_SRC/bash/tds}"
    local tds_dir="${TDS_DIR:-$TETRA_DIR/tds}"

    # Paths
    echo "-- Paths --"
    printf "  %-${label_width}s %s\n" "TDS_SRC:" "$tds_src"
    printf "  %-${label_width}s %s\n" "TDS_DIR:" "$tds_dir"
    printf "  %-${label_width}s %s\n" "TETRA_SRC:" "${TETRA_SRC:-<not set>}"
    printf "  %-${label_width}s %s\n" "TETRA_DIR:" "${TETRA_DIR:-<not set>}"
    echo

    # Theme status
    echo "-- Themes --"
    local theme_count=${#TDS_THEME_REGISTRY[@]}
    local active=$(tds_active_theme 2>/dev/null || echo "<none>")
    printf "  %-${label_width}s %s\n" "Active:" "$active"
    printf "  %-${label_width}s %d\n" "Registered:" "$theme_count"
    if [[ $theme_count -gt 0 ]]; then
        local themes_list=$(printf '%s ' "${!TDS_THEME_REGISTRY[@]}" | sort)
        printf "  %-${label_width}s %s\n" "Available:" "$themes_list"
    fi

    local theme_dir="$tds_src/themes"
    if [[ -d "$theme_dir" ]]; then
        local file_count=$(find "$theme_dir" -name "*.sh" ! -name "theme_registry.sh" 2>/dev/null | wc -l | tr -d ' ')
        printf "  %-${label_width}s %d files\n" "Theme files:" "$file_count"
    else
        printf "  %-${label_width}s %s\n" "Theme dir:" "x not found"
    fi
    echo

    # Palettes
    echo "-- Palettes --"
    for name in ENV_PRIMARY MODE_PRIMARY VERBS_PRIMARY NOUNS_PRIMARY; do
        declare -n arr="$name" 2>/dev/null
        local short_name="${name%_PRIMARY}"
        if [[ -n "${arr+x}" ]]; then
            printf "  %-${label_width}s %d colors" "$short_name:" "${#arr[@]}"
            [[ -n "${arr[0]:-}" ]] && printf " (%s)" "${arr[0]}"
            echo
        else
            printf "  %-${label_width}s %s\n" "$short_name:" "x undefined"
        fi
    done
    echo

    # Tokens
    echo "-- Tokens --"
    local token_count=${#TDS_COLOR_TOKENS[@]}
    printf "  %-${label_width}s %d\n" "Count:" "$token_count"
    if [[ $token_count -gt 0 ]]; then
        local -A seen_cats=()
        for token in "${!TDS_COLOR_TOKENS[@]}"; do
            seen_cats["${token%%.*}"]=1
        done
        local sorted_cats=$(printf '%s ' "${!seen_cats[@]}" | tr ' ' '\n' | sort | tr '\n' ' ')
        printf "  %-${label_width}s %s\n" "Categories:" "$sorted_cats"
    fi
    echo

    # Modules
    echo "-- Modules --"
    local module_count=${#_TDS_MODULE_CONFIGS[@]}
    printf "  %-${label_width}s %d\n" "Registered:" "$module_count"
    if [[ $module_count -gt 0 ]]; then
        printf "  %-${label_width}s %s\n" "Names:" "$(printf '%s ' "${!_TDS_MODULE_CONFIGS[@]}")"
    fi
    echo

    # Semantic colors
    echo "-- Semantic --"
    local semantic_count=${#TDS_SEMANTIC_COLORS[@]}
    printf "  %-${label_width}s %d\n" "Colors:" "$semantic_count"
    echo

    # Validation
    echo "-- Health Check --"
    local issues=0

    if [[ -z "$TETRA_SRC" ]]; then
        echo "  x TETRA_SRC not set"
        ((issues++))
    elif [[ ! -d "$TETRA_SRC" ]]; then
        echo "  x TETRA_SRC directory not found: $TETRA_SRC"
        ((issues++))
    else
        echo "  ok TETRA_SRC valid"
    fi

    if [[ $theme_count -eq 0 ]]; then
        echo "  x No themes registered"
        ((issues++))
    else
        echo "  ok Theme registry loaded ($theme_count themes)"
    fi

    if [[ -z "$active" || "$active" == "<none>" ]]; then
        echo "  x No active theme"
        ((issues++))
    else
        echo "  ok Active theme: $active"
    fi

    local palette_issues=0
    for name in ENV_PRIMARY MODE_PRIMARY VERBS_PRIMARY NOUNS_PRIMARY; do
        declare -n arr="$name" 2>/dev/null
        if [[ ! -v arr ]] || [[ ${#arr[@]} -eq 0 ]]; then
            ((palette_issues++))
        fi
    done
    if [[ $palette_issues -gt 0 ]]; then
        echo "  x $palette_issues palettes empty or undefined"
        ((issues++))
    else
        echo "  ok All palettes populated"
    fi

    if [[ $token_count -eq 0 ]]; then
        echo "  - No tokens defined (optional)"
    else
        echo "  ok Tokens defined ($token_count)"
    fi

    if [[ $module_count -gt 0 ]]; then
        echo "  ok Modules registered ($module_count)"
    fi

    echo
    if [[ $issues -eq 0 ]]; then
        echo "Status: ok Healthy"
    else
        echo "Status: x $issues issue(s) found"
    fi
    echo
}

export -f _tds_cmd_doctor
