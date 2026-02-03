#!/usr/bin/env bash
# org_build.sh - Assemble tetra.toml from section partials
#
# Structure (preferred - sections/):
#   $TETRA_DIR/orgs/<org>/sections/*.toml    → source partials
#   $TETRA_DIR/orgs/<org>/tetra.toml         → generated output
#
# Structure (fallback - flat):
#   $TETRA_DIR/orgs/<org>/[0-9][0-9]-*.toml  → source partials
#   $TETRA_DIR/orgs/<org>/tetra.toml         → generated output
#
# Section files are sorted alphabetically, so use numeric prefixes:
#   00-org.toml, 10-infrastructure.toml, 20-storage.toml, etc.

# =============================================================================
# SOURCE DIRECTORY DETECTION
# =============================================================================

# Find source files - returns glob pattern for sources
# Prefers sections/ subdirectory, falls back to flat NN-*.toml
_org_get_sources_dir() {
    local org_dir="$1"

    # Preferred: sections/ subdirectory
    if [[ -d "$org_dir/sections" ]]; then
        echo "$org_dir/sections"
        return 0
    fi

    # Fallback: flat NN-*.toml in org dir
    if compgen -G "$org_dir/[0-9][0-9]-*.toml" >/dev/null 2>&1; then
        echo "$org_dir"
        return 0
    fi

    return 1
}

# Get source file glob pattern
_org_get_sources_pattern() {
    local src_dir="$1"

    # If it's a sections dir, use *.toml
    if [[ "$src_dir" == */sections ]]; then
        echo "$src_dir/*.toml"
    else
        # Flat structure: only NN-*.toml files
        echo "$src_dir/[0-9][0-9]-*.toml"
    fi
}

# =============================================================================
# DIRTY DETECTION
# =============================================================================

# Check if tetra.toml needs rebuilding
_org_is_dirty() {
    local name="$1"
    local org_dir="$TETRA_DIR/orgs/$name"
    local output="$org_dir/tetra.toml"

    # No output = dirty
    [[ ! -f "$output" ]] && return 0

    local src_dir
    src_dir=$(_org_get_sources_dir "$org_dir") || return 0

    local pattern
    pattern=$(_org_get_sources_pattern "$src_dir")

    for src in $pattern; do
        [[ -f "$src" ]] || continue
        [[ "$src" -nt "$output" ]] && return 0
    done

    return 1
}

# =============================================================================
# VALIDATION
# =============================================================================

# TOML syntax check - delegates to shared helper
_org_build_validate_toml() {
    _org_validate_toml_syntax "$1"
}

# Extract all section names from a TOML file (uses shared helper)
_org_build_get_sections() {
    _org_extract_sections "$1"
}

# Check for duplicate sections across files
_org_build_check_duplicates() {
    local src_dir="$1"
    local pattern="$2"
    local -A seen_sections
    local duplicates=0

    for file in $pattern; do
        [[ -f "$file" ]] || continue
        local filename=$(basename "$file")

        while IFS= read -r section; do
            [[ -z "$section" ]] && continue
            if [[ -n "${seen_sections[$section]}" ]]; then
                echo "  Duplicate section [$section]:" >&2
                echo "    First: ${seen_sections[$section]}" >&2
                echo "    Also:  $filename" >&2
                ((duplicates++))
            else
                seen_sections[$section]="$filename"
            fi
        done < <(_org_build_get_sections "$file")
    done

    return $duplicates
}

# =============================================================================
# BUILD
# =============================================================================

# Assemble tetra.toml from sources
org_build() {
    local name="${1:-}"

    # If no name given, use active org
    if [[ -z "$name" ]]; then
        name=$(org_active 2>/dev/null)
        [[ "$name" == "$ORG_NO_ACTIVE" ]] && name=""
    fi

    if [[ -z "$name" ]]; then
        echo "Usage: org build [org_name]"
        echo "  Or switch to an org first: org switch <name>"
        return 1
    fi

    local org_dir="$TETRA_DIR/orgs/$name"
    local output_file="$org_dir/tetra.toml"

    # Find sources
    local src_dir
    src_dir=$(_org_get_sources_dir "$org_dir")
    if [[ $? -ne 0 ]]; then
        echo "No source files found in: $org_dir"
        echo ""
        echo "Create with: org init $name"
        return 1
    fi

    local pattern
    pattern=$(_org_get_sources_pattern "$src_dir")

    # Count source files
    local source_count=0
    for f in $pattern; do
        [[ -f "$f" ]] && ((source_count++))
    done

    if [[ $source_count -eq 0 ]]; then
        echo "No source files matching: $pattern"
        return 1
    fi

    echo "Build: $name"
    echo ""
    echo "Source: $src_dir/"

    # List and validate each source file
    local validation_errors=0
    local total_lines=0
    for file in $pattern; do
        [[ -f "$file" ]] || continue
        local filename=$(basename "$file")
        local lines=$(wc -l < "$file" | tr -d ' ')
        local sections=$(_org_build_get_sections "$file" | wc -l | tr -d ' ')
        ((total_lines += lines))

        if ! _org_build_validate_toml "$file" 2>/dev/null; then
            printf "  %-28s %3d lines  %d sections  [FAIL]\n" "$filename" "$lines" "$sections"
            ((validation_errors++))
        else
            printf "  %-28s %3d lines  %d sections\n" "$filename" "$lines" "$sections"
        fi
    done

    # Check for duplicate sections
    if ! _org_build_check_duplicates "$src_dir" "$pattern" 2>/dev/null; then
        ((validation_errors++))
    fi

    if [[ $validation_errors -gt 0 ]]; then
        echo ""
        echo "Build aborted: $validation_errors error(s)"
        return 1
    fi

    # Assemble
    {
        echo "# $name - tetra.toml"
        echo "# GENERATED by 'org build' - do not edit directly"
        echo "# Edit source files and rebuild"
        echo "# Built: $(date -Iseconds)"
        echo ""

        for file in $pattern; do
            [[ -f "$file" ]] || continue
            local filename=$(basename "$file")

            echo "# --- $filename ---"
            cat "$file"
            echo ""
        done
    } > "$output_file"

    echo ""
    echo "Output: $output_file"

    # Show what was created
    local out_lines=$(wc -l < "$output_file" | tr -d ' ')
    local env_count=$(grep -c '^\[env\.' "$output_file" 2>/dev/null || echo 0)

    echo "  $out_lines lines, $env_count environments"

    # Verify [org] section exists
    if ! grep -q '^\[org\]' "$output_file"; then
        echo ""
        echo "Warning: No [org] section found"
    fi

    echo ""
    echo "Next: org switch $name"

    return 0
}

# Initialize org with template files (sections/ structure)
org_build_init() {
    local name="${1:-}"

    if [[ -z "$name" ]]; then
        name=$(org_active 2>/dev/null)
        [[ "$name" == "$ORG_NO_ACTIVE" ]] && name=""
    fi

    if [[ -z "$name" ]]; then
        echo "Usage: org init <org_name>"
        return 1
    fi

    local org_dir="$TETRA_DIR/orgs/$name"
    local sections_dir="$org_dir/sections"

    echo "Init: $name"
    echo ""
    echo "Creating: $org_dir/"
    mkdir -p "$org_dir/backups"
    mkdir -p "$sections_dir"

    # Create template files in sections/
    echo ""
    echo "Sections:"
    if [[ ! -f "$sections_dir/00-org.toml" ]]; then
        cat > "$sections_dir/00-org.toml" << EOF
# Organization identity
[org]
name = "$name"
EOF
        echo "  00-org.toml            [org] name"
    else
        echo "  00-org.toml            (exists)"
    fi

    if [[ ! -f "$sections_dir/10-infrastructure.toml" ]]; then
        cat > "$sections_dir/10-infrastructure.toml" << EOF
# Infrastructure - environments
# Updated by: org import nh $name

[env.local]
description = "Local development"

# Remote environments added by nh import:
# [env.dev]
# host = "1.2.3.4"
# auth_user = "root"
# work_user = "dev"
EOF
        echo "  10-infrastructure.toml [env.*]"
    else
        echo "  10-infrastructure.toml (exists)"
    fi

    if [[ ! -f "$sections_dir/20-storage.toml" ]]; then
        cat > "$sections_dir/20-storage.toml" << EOF
# Storage configuration (S3/Spaces)

# [storage.s3]
# endpoint = "sfo3.digitaloceanspaces.com"
# bucket = "$name"
# region = "sfo3"

# [storage.documents]
# path = "documents/"

# [storage.games]
# path = "games/"
# manifest = "games.json"
EOF
        echo "  20-storage.toml        [storage]"
    else
        echo "  20-storage.toml        (exists)"
    fi

    if [[ ! -f "$sections_dir/25-pdata.toml" ]]; then
        cat > "$sections_dir/25-pdata.toml" << EOF
# PData - Project Data organization
# Used by tdocs for project/subject context
# Safe from nh_bridge (only touches 10-infrastructure.toml)

[pdata]
enabled = true
# path defaults to \$TETRA_DIR/orgs/$name/pd
EOF
        echo "  25-pdata.toml          [pdata]"

        # Create pd/ directory structure
        local pd_dir="$org_dir/pd"
        mkdir -p "$pd_dir/data/projects"
        mkdir -p "$pd_dir/config"
        mkdir -p "$pd_dir/cache"
    else
        echo "  25-pdata.toml          (exists)"
    fi

    if [[ ! -f "$sections_dir/30-resources.toml" ]]; then
        cat > "$sections_dir/30-resources.toml" << EOF
# Resources - application-specific assets

# [resources.games]
# manifest_path = "/var/www/arcade/games.json"
# assets_path = "/var/www/arcade/games/"

# [resources.documents]
# path = "/var/www/docs/"
EOF
        echo "  30-resources.toml      [resources]"
    else
        echo "  30-resources.toml      (exists)"
    fi

    if [[ ! -f "$sections_dir/40-services.toml" ]]; then
        cat > "$sections_dir/40-services.toml" << EOF
# Services and ports

# [services]
# app = 3000
# api = 8000
# admin = 9000
EOF
        echo "  40-services.toml       [services]"
    else
        echo "  40-services.toml       (exists)"
    fi

    if [[ ! -f "$sections_dir/50-custom.toml" ]]; then
        cat > "$sections_dir/50-custom.toml" << EOF
# User customizations (never overwritten by imports)

# [notes]
# description = "Custom configuration"
EOF
        echo "  50-custom.toml         [custom]"
    else
        echo "  50-custom.toml         (exists)"
    fi

    echo ""
    echo "Next: org import nh $name"
}

# List source files for an org
org_build_list() {
    local name="${1:-}"

    if [[ -z "$name" ]]; then
        name=$(org_active 2>/dev/null)
        [[ "$name" == "$ORG_NO_ACTIVE" ]] && name=""
    fi

    if [[ -z "$name" ]]; then
        echo "Usage: org sections [org_name]"
        return 1
    fi

    local org_dir="$TETRA_DIR/orgs/$name"

    local src_dir
    src_dir=$(_org_get_sources_dir "$org_dir")
    if [[ $? -ne 0 ]]; then
        echo "No source files for $name"
        echo "Initialize with: org init $name"
        return 1
    fi

    local pattern
    pattern=$(_org_get_sources_pattern "$src_dir")

    echo "Sources for $name:"
    echo ""

    for file in $pattern; do
        [[ -f "$file" ]] || continue
        local filename=$(basename "$file")
        local sections=$(_org_build_get_sections "$file" | wc -l | tr -d ' ')
        printf "  %-30s %d section(s)\n" "$filename" "$sections"
    done
}

# Functions available via source (no exports per CLAUDE.md)
