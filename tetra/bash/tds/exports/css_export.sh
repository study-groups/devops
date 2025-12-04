#!/usr/bin/env bash

# TDS CSS Export Layer
# Bridges TDS semantic tokens to CSS custom properties for web output
#
# Usage:
#   source $TDS_SRC/exports/css_export.sh
#   tds_export_css_root              # Output :root block
#   tds_export_css_file output.css   # Write to file

: "${TDS_SRC:=$TETRA_SRC/bash/tds}"

# CSS Variable Mapping
# Maps CSS custom property names to TDS semantic tokens
declare -gA TDS_CSS_TOKEN_MAP=(
    # Background tokens - use inverted palette indices for dark theme
    [--bg-primary]="structural.bg.primary"
    [--bg-secondary]="structural.bg.secondary"
    [--bg-tertiary]="structural.bg.tertiary"

    # Text tokens
    [--text-primary]="text.primary"
    [--text-secondary]="text.secondary"

    # Accent tokens
    [--accent-primary]="interactive.link"
    [--accent-secondary]="structural.secondary"

    # Status tokens
    [--success]="status.success"
    [--warning]="status.warning"
    [--error]="status.error"

    # UI tokens
    [--border]="structural.separator"
    [--highlight]="interactive.hover"
)

# Default hex values for structural.bg tokens (not in TDS_COLOR_TOKENS)
# These are GitHub dark theme values used as defaults
declare -gA TDS_CSS_BG_DEFAULTS=(
    [structural.bg.primary]="0d1117"
    [structural.bg.secondary]="161b22"
    [structural.bg.tertiary]="21262d"
)

# Resolve a TDS token to hex, with fallbacks for CSS-specific tokens
_tds_css_resolve() {
    local token="$1"

    # Check if it's a structural.bg token (CSS-specific)
    if [[ -n "${TDS_CSS_BG_DEFAULTS[$token]}" ]]; then
        # Try to resolve from theme if available, else use defaults
        if [[ -n "${TDS_COLOR_TOKENS[$token]}" ]]; then
            tds_resolve_color "$token"
        else
            echo "${TDS_CSS_BG_DEFAULTS[$token]}"
        fi
        return
    fi

    # Standard TDS token resolution
    if type -t tds_resolve_color &>/dev/null; then
        tds_resolve_color "$token"
    else
        echo "c9d1d9"  # Fallback light text
    fi
}

# Export all CSS tokens as :root block
# Output: CSS :root { } declaration with all mapped variables
tds_export_css_root() {
    local indent="${1:-    }"

    echo ":root {"

    # Export in logical order for readability
    local -a order=(
        "--bg-primary" "--bg-secondary" "--bg-tertiary"
        "--text-primary" "--text-secondary"
        "--accent-primary" "--accent-secondary"
        "--success" "--warning" "--error"
        "--border" "--highlight"
    )

    for css_var in "${order[@]}"; do
        local tds_token="${TDS_CSS_TOKEN_MAP[$css_var]}"
        local hex=$(_tds_css_resolve "$tds_token")

        # Handle highlight special case (needs alpha)
        if [[ "$css_var" == "--highlight" ]]; then
            echo "${indent}${css_var}: #${hex}26;"
        else
            echo "${indent}${css_var}: #${hex};"
        fi
    done

    echo "}"
}

# Export CSS tokens as JSON object
tds_export_css_json() {
    echo "{"

    local -a order=(
        "--bg-primary" "--bg-secondary" "--bg-tertiary"
        "--text-primary" "--text-secondary"
        "--accent-primary" "--accent-secondary"
        "--success" "--warning" "--error"
        "--border" "--highlight"
    )

    local first=true
    for css_var in "${order[@]}"; do
        local tds_token="${TDS_CSS_TOKEN_MAP[$css_var]}"
        local hex=$(_tds_css_resolve "$tds_token")

        # Convert --var-name to camelCase for JSON
        local json_key="${css_var#--}"
        json_key=$(echo "$json_key" | sed -E 's/-([a-z])/\U\1/g')

        [[ "$first" == "true" ]] || echo ","
        first=false

        if [[ "$css_var" == "--highlight" ]]; then
            printf '  "%s": "#%s26"' "$json_key" "$hex"
        else
            printf '  "%s": "#%s"' "$json_key" "$hex"
        fi
    done

    echo ""
    echo "}"
}

# Write CSS to file
tds_export_css_file() {
    local output_file="$1"
    local theme="${2:-default}"

    {
        echo "/* TDS Theme: $theme */"
        echo "/* Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ) */"
        echo ""
        tds_export_css_root
    } > "$output_file"

    echo "CSS exported to: $output_file"
}

# Show mapping table
tds_css_show_mapping() {
    echo "TDS → CSS Token Mapping"
    echo "======================="
    echo ""
    printf "%-20s %-30s %s\n" "CSS Variable" "TDS Token" "Value"
    printf "%-20s %-30s %s\n" "------------" "---------" "-----"

    local -a order=(
        "--bg-primary" "--bg-secondary" "--bg-tertiary"
        "--text-primary" "--text-secondary"
        "--accent-primary" "--accent-secondary"
        "--success" "--warning" "--error"
        "--border" "--highlight"
    )

    for css_var in "${order[@]}"; do
        local tds_token="${TDS_CSS_TOKEN_MAP[$css_var]}"
        local hex=$(_tds_css_resolve "$tds_token")
        printf "%-20s %-30s #%s\n" "$css_var" "$tds_token" "$hex"
    done
}

# Export function for use by other modules
export -f tds_export_css_root tds_export_css_json tds_export_css_file tds_css_show_mapping
