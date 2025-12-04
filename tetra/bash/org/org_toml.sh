#!/usr/bin/env bash
# org_toml.sh - Operations on THE active tetra.toml
#
# All functions operate on the symlinked tetra.toml:
#   $TETRA_DIR/config/tetra.toml -> $TETRA_DIR/orgs/<active>/tetra.toml

# =============================================================================
# PATH HELPERS
# =============================================================================

# Get path to active tetra.toml (follows symlink)
org_toml_path() {
    local link="$TETRA_DIR/config/tetra.toml"
    if [[ -L "$link" ]]; then
        readlink "$link"
    elif [[ -f "$link" ]]; then
        echo "$link"
    else
        return 1
    fi
}

# Check if active org exists
org_toml_exists() {
    local toml=$(org_toml_path 2>/dev/null)
    [[ -n "$toml" && -f "$toml" ]]
}

# =============================================================================
# VIEW OPERATIONS
# =============================================================================

# View entire toml or filter by section prefix
org_toml_view() {
    local filter="${1:-}"
    local toml=$(org_toml_path) || { echo "No active org"; return 1; }

    if [[ -z "$filter" ]]; then
        # Show entire file
        cat "$toml"
    else
        # Filter by section prefix (e.g., "environments" shows all [environments.*])
        org_toml_grep_sections "$filter"
    fi
}

# Show a specific section by exact name
org_toml_section() {
    local section="$1"
    local toml=$(org_toml_path) || { echo "No active org"; return 1; }

    [[ -z "$section" ]] && { echo "Usage: org section <name>"; return 1; }

    # Extract section content
    awk -v sect="$section" '
        BEGIN { printing = 0 }
        /^\[/ {
            if ($0 == "[" sect "]") {
                printing = 1
                print
                next
            } else if (printing) {
                exit
            }
        }
        printing { print }
    ' "$toml"
}

# List all section names in the toml
org_toml_sections() {
    local toml=$(org_toml_path) || { echo "No active org"; return 1; }
    grep -oE '^\[[^]]+\]' "$toml" | tr -d '[]' | sort -u
}

# List top-level section names (for completion)
org_toml_sections_top() {
    local toml=$(org_toml_path 2>/dev/null) || return
    grep -oE '^\[[^].]+' "$toml" | tr -d '[' | sort -u
}

# Grep sections matching a prefix
org_toml_grep_sections() {
    local prefix="$1"
    local toml=$(org_toml_path) || return 1

    awk -v prefix="$prefix" '
        BEGIN { printing = 0 }
        /^\[/ {
            section = $0
            gsub(/[\[\]]/, "", section)
            if (section ~ "^" prefix) {
                printing = 1
                print $0
            } else {
                printing = 0
            }
            next
        }
        printing { print }
    ' "$toml"
}

# =============================================================================
# GET/SET OPERATIONS
# =============================================================================

# Get a value by dotted path (e.g., environments.dev.ip)
org_toml_get() {
    local path="$1"
    local toml=$(org_toml_path) || { echo "No active org"; return 1; }

    [[ -z "$path" ]] && { echo "Usage: org get <key.path>"; return 1; }

    # Split path into section and key
    # e.g., "environments.dev.ip" -> section="environments.dev", key="ip"
    local section="${path%.*}"
    local key="${path##*.}"

    # Handle single-level (e.g., "org.name" -> section="org", key="name")
    if [[ "$section" == "$key" ]]; then
        echo "Invalid path: $path (need section.key format)"
        return 1
    fi

    # Extract value from section
    awk -v sect="$section" -v key="$key" '
        BEGIN { in_section = 0 }
        /^\[/ {
            current = $0
            gsub(/[\[\]]/, "", current)
            in_section = (current == sect)
            next
        }
        in_section && /^[[:space:]]*[a-zA-Z_][a-zA-Z0-9_]*[[:space:]]*=/ {
            # Extract key name
            match($0, /^[[:space:]]*([a-zA-Z_][a-zA-Z0-9_]*)/, arr)
            if (substr($0, RSTART, RLENGTH) ~ key) {
                # Found the key, extract value
                sub(/^[^=]*=[[:space:]]*/, "")
                # Remove quotes if present
                gsub(/^["'\'']|["'\'']$/, "")
                print
                exit
            }
        }
    ' "$toml"
}

# Set a value (simple implementation - only works for existing keys)
org_toml_set() {
    local path="$1"
    local value="$2"
    local toml=$(org_toml_path) || { echo "No active org"; return 1; }

    [[ -z "$path" || -z "$value" ]] && { echo "Usage: org set <key.path> <value>"; return 1; }

    local section="${path%.*}"
    local key="${path##*.}"

    # Create temp file
    local tmp=$(mktemp)

    # Use awk to update the value
    awk -v sect="$section" -v key="$key" -v val="$value" '
        BEGIN { in_section = 0; found = 0 }
        /^\[/ {
            current = $0
            gsub(/[\[\]]/, "", current)
            in_section = (current == sect)
            print
            next
        }
        in_section && $0 ~ "^[[:space:]]*" key "[[:space:]]*=" {
            # Check if value needs quotes
            if (val ~ /^[0-9]+$/ || val == "true" || val == "false") {
                print key " = " val
            } else {
                print key " = \"" val "\""
            }
            found = 1
            next
        }
        { print }
        END {
            if (!found) {
                print "Warning: key not found, not added" > "/dev/stderr"
            }
        }
    ' "$toml" > "$tmp"

    mv "$tmp" "$toml"
    echo "Updated: $path = $value"
}

# =============================================================================
# EDIT OPERATIONS
# =============================================================================

# Open tetra.toml in editor
org_toml_edit() {
    local toml=$(org_toml_path) || { echo "No active org"; return 1; }
    ${EDITOR:-vim} "$toml"
}

# =============================================================================
# VALIDATION
# =============================================================================

# Basic TOML validation
org_toml_validate() {
    local toml=$(org_toml_path) || { echo "No active org"; return 1; }
    local errors=0

    echo "Validating: $toml"
    echo ""

    # Check for basic syntax issues
    local line_num=0
    local in_multiline=false

    while IFS= read -r line || [[ -n "$line" ]]; do
        ((line_num++))

        # Skip empty lines and comments
        [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue

        # Check section headers
        if [[ "$line" =~ ^\[.*\]$ ]]; then
            # Valid section header
            local sect="${line#[}"
            sect="${sect%]}"
            if [[ ! "$sect" =~ ^[a-zA-Z_][a-zA-Z0-9_.-]*$ ]]; then
                echo "Line $line_num: Invalid section name: $sect"
                ((errors++))
            fi
            continue
        fi

        # Check key=value pairs
        if [[ "$line" =~ ^[[:space:]]*[a-zA-Z_][a-zA-Z0-9_]*[[:space:]]*= ]]; then
            # Basic key=value, OK
            continue
        fi

        # Check for continuation of previous value (arrays, etc)
        if [[ "$line" =~ ^[[:space:]]*[\]\}] ]] || [[ "$line" =~ ^[[:space:]]*\" ]]; then
            continue
        fi

        # Unrecognized line
        if [[ ! "$line" =~ ^[[:space:]]*$ ]]; then
            echo "Line $line_num: Unrecognized: $line"
            ((errors++))
        fi

    done < "$toml"

    # Check required sections
    local sections=$(org_toml_sections)
    if ! echo "$sections" | grep -q '^org$'; then
        echo "Missing required section: [org]"
        ((errors++))
    fi

    echo ""
    if [[ $errors -eq 0 ]]; then
        echo "OK - No errors found"
        return 0
    else
        echo "ERRORS: $errors"
        return 1
    fi
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f org_toml_path org_toml_exists
export -f org_toml_view org_toml_section org_toml_sections org_toml_sections_top
export -f org_toml_grep_sections
export -f org_toml_get org_toml_set
export -f org_toml_edit org_toml_validate
