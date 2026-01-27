#!/usr/bin/env bash
# org_guide.sh - Generate client setup guide HTML
#
# Reads org config and generates a PlaceholderMedia-style setup guide
# with DNS access info, Google Sites info, Stripe, and action items.
#
# Usage:
#   org guide [org_name]           Generate setup-guide.html
#   org guide --preview [org_name] Output to stdout

GUIDE_SRC="${ORG_SRC}/guide"

# Source components
source "$GUIDE_SRC/helpers.sh"
source "$GUIDE_SRC/css.sh"
source "$GUIDE_SRC/sections.sh"

# =============================================================================
# HTML GENERATION
# =============================================================================

_org_guide_generate_html() {
    local org_name="$1"

    # Read all config into ORG_* variables
    _org_guide_read_config "$org_name"

    # HTML document
    cat << EOF
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${ORG_DISPLAY} - Setup Guide</title>
    <style>
$(_org_guide_css)
    </style>
</head>
<body>
$(_org_guide_section_header)

    <main class="main">
$(_org_guide_section_progress)

        <div class="grid">
$(_org_guide_section_domain)
$(_org_guide_section_infra)
$(_org_guide_section_google_sites)
$(_org_guide_section_analytics)
$(_org_guide_section_stripe)
$(_org_guide_section_actions)
$(_org_guide_section_future)
$(_org_guide_section_commands)
$(_org_guide_section_architecture)
$(_org_guide_section_links)
        </div>
    </main>

$(_org_guide_section_footer)
</body>
</html>
EOF
}

# =============================================================================
# MAIN COMMAND
# =============================================================================

org_guide() {
    local preview=false
    local org_name=""

    # Parse args
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --preview|-p) preview=true; shift ;;
            --help|-h)
                echo "org guide - Generate client setup guide"
                echo ""
                echo "Usage:"
                echo "  org guide [org_name]           Generate workspace/content/setup-guide.html"
                echo "  org guide --preview [org_name] Output to stdout"
                echo ""
                echo "Reads from org config files:"
                echo "  sections/00-org.toml      Org identity"
                echo "  sections/20-google.toml   Google Sites/Analytics"
                echo "  sections/30-payments.toml Stripe payments"
                echo "  sections/40-dns.toml      DNS provider"
                echo "  domains/*/dns.toml        Domain-specific DNS"
                echo ""
                return 0
                ;;
            *) org_name="$1"; shift ;;
        esac
    done

    # Default to active org
    if [[ -z "$org_name" ]]; then
        org_name=$(org_active 2>/dev/null)
        if [[ -z "$org_name" || "$org_name" == "$ORG_NO_ACTIVE" ]]; then
            echo "No active org. Usage: org guide <org_name>" >&2
            return 1
        fi
    fi

    local org_dir="$TETRA_DIR/orgs/$org_name"
    if [[ ! -d "$org_dir" ]]; then
        echo "Org not found: $org_name" >&2
        return 1
    fi

    if [[ "$preview" == true ]]; then
        _org_guide_generate_html "$org_name"
    else
        local output_dir="$org_dir/workspace/content"
        local output_file="$output_dir/setup-guide.html"

        mkdir -p "$output_dir"
        _org_guide_generate_html "$org_name" > "$output_file"

        echo "Generated: $output_file"
        echo ""
        echo "View in browser:"
        echo "  open $output_file"
    fi
}

export -f org_guide _org_guide_generate_html
