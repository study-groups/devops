#!/usr/bin/env bash
# gamepak/core/doctor.sh - Fix index.html issues, inject SDK

# =============================================================================
# BACKUP MANAGEMENT
# =============================================================================

# Create backup of index.html (first time only)
_gamepak_backup() {
    local dir="$1"
    local html_file="$dir/index.html"
    local backup_dir="$dir/.original"
    local backup_file="$backup_dir/index.html"

    if [[ ! -f "$backup_file" ]]; then
        mkdir -p "$backup_dir"
        cp "$html_file" "$backup_file"
        echo "Backup created: $backup_file"
    fi
}

# Restore from backup
_gamepak_restore() {
    local dir="$1"
    local html_file="$dir/index.html"
    local backup_file="$dir/.original/index.html"

    if [[ ! -f "$backup_file" ]]; then
        echo "No backup found at $backup_file" >&2
        return 1
    fi

    cp "$backup_file" "$html_file"
    echo "Restored from backup"
}

# =============================================================================
# FIX FUNCTIONS (Idempotent)
# =============================================================================

# Inject viewport meta tag
_gamepak_fix_viewport() {
    local html_file="$1"

    # Skip if already has viewport or our marker
    if grep -qiE '<meta[^>]*viewport|<!-- PJA-VIEWPORT -->' "$html_file"; then
        return 0
    fi

    # Insert after <head>
    sed -i.tmp 's|<head>|<head>\
<!-- PJA-VIEWPORT -->\
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">|i' "$html_file"
    rm -f "$html_file.tmp"
    echo "  [FIX] Added viewport meta"
}

# Inject CSS reset for iframe compatibility
_gamepak_fix_css() {
    local html_file="$1"

    # Skip if already has our CSS
    if grep -q 'id="pja-css-reset"' "$html_file"; then
        return 0
    fi

    local css_block='<!-- PJA-CSS-RESET -->
<style id="pja-css-reset">
html, body {
  margin: 0;
  padding: 0;
  overflow: hidden;
  width: 100%;
  height: 100%;
}
</style>'

    # Insert before </head>
    sed -i.tmp "s|</head>|$css_block\
</head>|i" "$html_file"
    rm -f "$html_file.tmp"
    echo "  [FIX] Added CSS reset"
}

# Inject PJA SDK
_gamepak_fix_sdk() {
    local html_file="$1"

    # Skip if already has SDK
    if grep -qiE 'pja-sdk\.iife\.js|id="pja-sdk"' "$html_file"; then
        echo "  [SKIP] SDK already present"
        return 0
    fi

    local sdk_url="${GAMEPAK_SDK_URL:-https://pja-games.sfo3.digitaloceanspaces.com/sdk/pja-sdk.iife.js}"

    local sdk_block="<!-- PJA-SDK -->
<script id=\"pja-sdk\" src=\"$sdk_url\"></script>
<script>
  window.addEventListener('load', function() {
    if (window.PJA && PJA.init) {
      PJA.init();
      PJA.notify('gameLoaded');
    }
  });
</script>"

    # Insert before </head>
    sed -i.tmp "s|</head>|$sdk_block\
</head>|i" "$html_file"
    rm -f "$html_file.tmp"
    echo "  [FIX] Injected PJA SDK"
}

# =============================================================================
# MAIN DOCTOR COMMAND
# =============================================================================

gamepak_doctor() {
    local dir="."
    local do_fix=false
    local sdk_only=false
    local restore=false

    # Parse options
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --fix|-f) do_fix=true ;;
            --inject-sdk|--sdk) sdk_only=true; do_fix=true ;;
            --restore|-r) restore=true ;;
            -*) echo "Unknown option: $1" >&2; return 1 ;;
            *) dir="$1" ;;
        esac
        shift
    done

    # Resolve directory
    [[ "$dir" != /* ]] && dir="$(cd "$dir" 2>/dev/null && pwd)"

    local html_file="$dir/index.html"

    if [[ ! -f "$html_file" ]]; then
        echo "No index.html found in $dir" >&2
        return 1
    fi

    # Handle restore
    if $restore; then
        _gamepak_restore "$dir"
        return
    fi

    echo "Gamepak Doctor"
    echo "=============="
    echo ""
    echo "File: $html_file"
    echo ""

    # Check for issues
    local sdk_status=$(_gamepak_detect_sdk "$html_file")
    local css_issues=$(_gamepak_check_css "$html_file")

    local has_issues=false

    # Report issues
    echo "Diagnostics:"

    if [[ "$sdk_status" == "missing" ]]; then
        echo "  [WARN] PJA SDK not detected"
        has_issues=true
    else
        echo "  [OK]   SDK: $sdk_status"
    fi

    if [[ "$css_issues" != "ok" ]]; then
        while IFS= read -r issue; do
            local code="${issue%%:*}"
            local desc="${issue#*: }"
            echo "  [WARN] $desc"
        done <<< "$css_issues"
        has_issues=true
    else
        echo "  [OK]   CSS checks passed"
    fi

    # Check for backup
    echo ""
    if [[ -f "$dir/.original/index.html" ]]; then
        echo "Backup:  $dir/.original/index.html"
    else
        echo "Backup:  (none - will be created on first fix)"
    fi

    # Apply fixes if requested
    if $do_fix && $has_issues; then
        echo ""
        echo "Applying fixes..."
        echo ""

        # Create backup first
        _gamepak_backup "$dir"

        if $sdk_only; then
            # SDK only
            _gamepak_fix_sdk "$html_file"
        else
            # All fixes
            # Viewport
            if ! grep -qiE '<meta[^>]*viewport' "$html_file"; then
                _gamepak_fix_viewport "$html_file"
            fi

            # CSS reset
            if [[ "$css_issues" != "ok" ]]; then
                _gamepak_fix_css "$html_file"
            fi

            # SDK
            if [[ "$sdk_status" == "missing" ]]; then
                _gamepak_fix_sdk "$html_file"
            fi
        fi

        echo ""
        echo "Fixes applied. Run 'gamepak inspect' to verify."
        echo "To undo: gamepak doctor --restore"
    elif $do_fix && ! $has_issues; then
        echo ""
        echo "No fixes needed."
    elif $has_issues; then
        echo ""
        echo "Run 'gamepak doctor --fix' to apply fixes."
    fi
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f _gamepak_backup _gamepak_restore
export -f _gamepak_fix_viewport _gamepak_fix_css _gamepak_fix_sdk
export -f gamepak_doctor
