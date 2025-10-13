#!/usr/bin/env bash

# Tetra TOML Compiler
# Compiles tetra.toml from multiple input sources with secrets interpolation
#
# INPUTS:
#   - digitalocean.json (infrastructure topology)
#   - mapping.json (environment mappings)
#   - resources.toml (file sync definitions)
#   - ports.json (optional - can be in mapping.json)
#   - secrets.env (REQUIRED - actual credentials)
#
# OUTPUT:
#   - tetra.toml (TES 2.1 compliant config with embedded secrets)
#
# SECURITY:
#   - tetra.toml contains secrets - NEVER check into git
#   - Always validate secrets.env exists and has 600 permissions

set -euo pipefail

# Source required modules
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/converter.sh"
source "$SCRIPT_DIR/secrets_manager.sh"

# Compile tetra.toml from all input sources
tetra_compile_toml() {
    local org_name="$1"
    local force="${2:-false}"

    if [[ -z "$org_name" ]]; then
        echo "Error: Organization name required" >&2
        return 1
    fi

    local org_dir="$TETRA_DIR/org/$org_name"

    # Input files
    local json_file="$org_dir/digitalocean.json"
    local mapping_file="$org_dir/mapping.json"
    local resources_file="$org_dir/resources.toml"
    local secrets_file="$org_dir/secrets.env"

    # Output file
    local output_file="$org_dir/tetra.toml"

    echo ""
    echo "═══════════════════════════════════════════════════════════"
    echo "  TETRA TOML COMPILER"
    echo "═══════════════════════════════════════════════════════════"
    echo ""
    echo "Organization: $org_name"
    echo "Directory: $org_dir"
    echo ""

    # Step 1: Validate inputs
    echo "[1/6] Validating input files..."
    _validate_input_files "$json_file" "$mapping_file" "$secrets_file" || return 1
    echo "   ✅ Required inputs found"
    echo ""

    # Step 2: Validate secrets
    echo "[2/6] Validating secrets..."
    tetra_secrets_validate "$org_name" || {
        echo "   ❌ Secrets validation failed"
        return 1
    }
    echo ""

    # Step 3: Check if output exists
    if [[ -f "$output_file" && "$force" != "true" ]]; then
        echo "⚠️  Output file exists: $output_file"
        echo "   Use --force to overwrite"
        echo "   Creating backup..."
        local backup_dir="$org_dir/backups"
        mkdir -p "$backup_dir"
        local backup_name="tetra.toml.backup.$(date +%Y%m%d_%H%M%S)"
        cp "$output_file" "$backup_dir/$backup_name"
        echo "   ✅ Backed up to: $backup_dir/$backup_name"
        echo ""
    fi

    # Step 4: Load secrets into environment
    echo "[3/6] Loading secrets..."
    set -a
    source "$secrets_file"
    set +a
    echo "   ✅ Secrets loaded into environment"
    echo ""

    # Step 5: Generate base TOML using converter
    echo "[4/6] Generating base configuration..."
    local temp_toml="/tmp/${org_name}_base_$(date +%s).toml"

    tetra_convert_with_mapping "$json_file" "$mapping_file" "$temp_toml" || {
        echo "   ❌ Base conversion failed"
        return 1
    }
    echo "   ✅ Base TOML generated"
    echo ""

    # Step 6: Append storage section if resources.toml has storage config
    echo "[5/7] Adding storage section..."
    if [[ -f "$resources_file" ]]; then
        _append_storage_section "$resources_file" "$temp_toml"
    else
        echo "   ⚠️  No resources.toml found - skipping storage"
    fi
    echo ""

    # Step 7: Append resources section if resources.toml exists
    echo "[6/7] Adding resources section..."
    if [[ -f "$resources_file" ]]; then
        _append_resources_section "$resources_file" "$temp_toml"
        echo "   ✅ Resources section added from: $(basename "$resources_file")"
    else
        echo "   ⚠️  No resources.toml found - skipping"
    fi
    echo ""

    # Step 8: Interpolate secrets and finalize
    echo "[7/7] Finalizing with secrets interpolation..."
    _interpolate_secrets "$temp_toml" "$output_file"
    rm "$temp_toml"
    echo "   ✅ Secrets interpolated"
    echo ""

    # Validation and summary
    echo "═══════════════════════════════════════════════════════════"
    echo "  COMPILATION COMPLETE"
    echo "═══════════════════════════════════════════════════════════"
    echo ""
    echo "📄 Output: $output_file"
    echo ""
    echo "⚠️  SECURITY WARNING:"
    echo "   This file contains secrets - NEVER commit to git"
    echo "   Ensure org/*/tetra.toml is in .gitignore"
    echo ""

    # Show summary
    _show_compilation_summary "$output_file"

    return 0
}

# Validate required input files exist
_validate_input_files() {
    local json_file="$1"
    local mapping_file="$2"
    local secrets_file="$3"

    local errors=0

    if [[ ! -f "$json_file" ]]; then
        echo "   ❌ Missing: digitalocean.json"
        errors=$((errors + 1))
    fi

    if [[ ! -f "$mapping_file" ]]; then
        echo "   ❌ Missing: mapping.json"
        errors=$((errors + 1))
    fi

    if [[ ! -f "$secrets_file" ]]; then
        echo "   ❌ Missing: secrets.env"
        echo "      Initialize with: tetra org secrets init <org_name>"
        errors=$((errors + 1))
    else
        # Check permissions
        local perms
        perms=$(stat -f "%Lp" "$secrets_file" 2>/dev/null || stat -c "%a" "$secrets_file" 2>/dev/null)
        if [[ "$perms" != "600" ]]; then
            echo "   ⚠️  secrets.env has insecure permissions: $perms"
            echo "      Fixing to 600..."
            chmod 600 "$secrets_file"
        fi
    fi

    if [[ $errors -gt 0 ]]; then
        return 1
    fi

    return 0
}

# Append storage section from resources.toml to output
_append_storage_section() {
    local resources_file="$1"
    local output_file="$2"

    # Check if resources.toml has storage config
    if ! grep -q '^\[_config.storage\]' "$resources_file"; then
        echo "   ⚠️  No storage config in resources.toml - skipping"
        return 0
    fi

    # Add header
    cat >> "$output_file" << 'EOF'

# ═══════════════════════════════════════════════════════════
# STORAGE (TES Extension: Cloud Storage Endpoints)
# S3-compatible storage with progressive symbol resolution
# Symbol format: @storage:bucket[:path]
# ═══════════════════════════════════════════════════════════

EOF

    # Extract storage config from resources.toml _config section
    # Get storage backend name from _config
    local storage_backend storage_symbol
    storage_backend=$(awk '/^\[_config.storage\]/,/^\[/ { if (/^backend/) print $3 }' "$resources_file" | tr -d '"')

    # Determine symbol name based on backend
    case "$storage_backend" in
        digitalocean-spaces)
            storage_symbol="spaces"
            ;;
        aws-s3)
            storage_symbol="s3"
            ;;
        s3-compatible)
            storage_symbol="s3"
            ;;
        *)
            storage_symbol="storage"
            ;;
    esac

    # Build storage section
    echo "[storage.$storage_symbol]" >> "$output_file"
    echo "symbol = \"@$storage_symbol\"" >> "$output_file"

    # Extract and append storage config fields
    awk '/^\[_config.storage\]/,/^\[/ {
        if (/^backend/ || /^endpoint/ || /^region/ || /^bucket/ || /^credentials_env/) {
            if ($1 == "credentials_env") {
                # Expand credentials_env into access_key and secret_key
                prefix = $3
                gsub(/"/, "", prefix)
                print "access_key = \"${" prefix "_KEY}\""
                print "secret_key = \"${" prefix "_SECRET}\""
            } else if ($1 == "bucket") {
                print "default_bucket = " $3
            } else {
                print
            }
        }
    }' "$resources_file" >> "$output_file"

    echo "" >> "$output_file"
    echo "   ✅ Storage section added"
}

# Append resources section from resources.toml to output
_append_resources_section() {
    local resources_file="$1"
    local output_file="$2"

    # Add header
    cat >> "$output_file" << 'EOF'

# ═══════════════════════════════════════════════════════════
# RESOURCES (TES Level 5: File Sync Definitions)
# Defines what files/configs to sync between environments
# Uses TES symbols resolved at runtime
# ═══════════════════════════════════════════════════════════

EOF

    # Skip the _config section (handled separately) and append resources
    # Convert TOML to include only [resources.*] sections
    awk '
        /^\[resources\./ { in_resource=1 }
        /^\[_config/ { in_resource=0; next }
        in_resource || /^# / { print }
        /^$/ && in_resource { print }
    ' "$resources_file" >> "$output_file"
}

# Interpolate environment variables (secrets) into TOML
_interpolate_secrets() {
    local input_file="$1"
    local output_file="$2"

    # Use envsubst to replace ${VAR} and $VAR patterns
    # But preserve literal ${connectors.@dev} style references
    envsubst < "$input_file" > "$output_file"
}

# Show compilation summary
_show_compilation_summary() {
    local toml_file="$1"

    local sections
    sections=$(grep '^\[' "$toml_file" | wc -l | tr -d ' ')

    local resources_count
    resources_count=$(grep '^\[resources\.' "$toml_file" | wc -l | tr -d ' ')

    local file_size
    file_size=$(stat -f "%z" "$toml_file" 2>/dev/null || stat -c "%s" "$toml_file" 2>/dev/null)

    echo "📊 Summary:"
    echo "   Sections: $sections"
    echo "   Resources: $resources_count"
    echo "   File size: $file_size bytes"
    echo ""
}

# Quick recompile (assumes inputs haven't changed)
tetra_quick_compile() {
    local org_name="$1"

    echo "⚡ Quick recompile: $org_name"
    tetra_compile_toml "$org_name" --force
}

# Validate compiled TOML
tetra_validate_toml() {
    local org_name="$1"

    local org_dir="$TETRA_DIR/org/$org_name"
    local toml_file="$org_dir/tetra.toml"

    if [[ ! -f "$toml_file" ]]; then
        echo "❌ No compiled TOML found: $toml_file"
        echo "Run: tetra org compile $org_name"
        return 1
    fi

    echo "Validating: $toml_file"
    echo ""

    # Check for required sections
    local required_sections=("metadata" "symbols" "connectors" "ports" "environments")
    local missing_sections=()

    for section in "${required_sections[@]}"; do
        if ! grep -q "^\[$section\]" "$toml_file"; then
            missing_sections+=("$section")
        fi
    done

    if [[ ${#missing_sections[@]} -gt 0 ]]; then
        echo "❌ Missing required sections:"
        for section in "${missing_sections[@]}"; do
            echo "   - [$section]"
        done
        return 1
    fi

    # Check for unresolved variables (potential secrets not interpolated)
    local unresolved
    unresolved=$(grep -E '\$\{[A-Z_]+\}' "$toml_file" | grep -v '\${connectors\.' | grep -v '\${infrastructure\.' || true)

    if [[ -n "$unresolved" ]]; then
        echo "⚠️  Found unresolved variables:"
        echo "$unresolved"
        echo ""
        echo "These may indicate missing secrets in secrets.env"
    fi

    echo "✅ TOML structure valid"
    return 0
}

# Export functions
export -f tetra_compile_toml
export -f tetra_quick_compile
export -f tetra_validate_toml

# CLI interface
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    case "${1:-help}" in
        compile)
            shift
            tetra_compile_toml "$@"
            ;;
        quick)
            shift
            tetra_quick_compile "$@"
            ;;
        validate)
            shift
            tetra_validate_toml "$@"
            ;;
        help|--help|-h)
            cat << EOF
Tetra TOML Compiler

USAGE:
    compiler.sh <command> [options]

COMMANDS:
    compile <org_name> [--force]
        Compile tetra.toml from all input sources
        Inputs: digitalocean.json, mapping.json, resources.toml, secrets.env
        Output: tetra.toml (with embedded secrets)

    quick <org_name>
        Quick recompile (forces overwrite)

    validate <org_name>
        Validate compiled tetra.toml structure

    help
        Show this help

EXAMPLES:
    # Full compilation
    compiler.sh compile pixeljam-arcade

    # Force overwrite
    compiler.sh compile pixeljam-arcade --force

    # Quick recompile
    compiler.sh quick pixeljam-arcade

    # Validate output
    compiler.sh validate pixeljam-arcade

INPUT FILES ($TETRA_DIR/org/<org_name>/):
    digitalocean.json  - Infrastructure from DigitalOcean API
    mapping.json       - Environment mappings (@dev, @staging, @prod)
    resources.toml     - File sync definitions (optional)
    ports.json         - Port registry (optional, can be in mapping.json)
    secrets.env        - REQUIRED: Actual credentials (NEVER commit!)

OUTPUT FILE:
    tetra.toml         - TES 2.1 compliant config (NEVER commit!)

SECURITY:
    - secrets.env and tetra.toml contain sensitive data
    - Both must be in .gitignore
    - Compiler validates secrets.env has 600 permissions
    - Creates backups before overwriting

WORKFLOW:
    1. Validate all input files exist
    2. Validate secrets.env (permissions + content)
    3. Backup existing tetra.toml if it exists
    4. Load secrets into environment
    5. Generate base TOML from infrastructure + mapping
    6. Append resources section from resources.toml
    7. Interpolate secrets into final output
EOF
            ;;
        *)
            echo "Unknown command: $1"
            echo "Use 'compiler.sh help' for usage information"
            exit 1
            ;;
    esac
fi
