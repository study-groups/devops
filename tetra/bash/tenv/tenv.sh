#!/usr/bin/env bash
# tenv - Project environment file manager
# Works on ./tetra.toml in current directory
# Generates ./env/<environment>.env files

# =============================================================================
# HELPERS
# =============================================================================

# Extract environment names from local tetra.toml
_tenv_envs() {
    local toml="./tetra.toml"
    [[ -f "$toml" ]] || return
    grep -E '^\[environments\.[^]]+\]' "$toml" 2>/dev/null | sed 's/.*\.//;s/\]//' | sort -u
}

# Get project name from [service] or [project] section
_tenv_project_name() {
    local toml="./tetra.toml"
    [[ -f "$toml" ]] || { echo "unknown"; return; }

    # Try [service].name first, then [project].name
    local name=$(grep -A5 '^\[service\]' "$toml" 2>/dev/null | grep '^name *=' | head -1 | sed 's/[^=]*= *"*//;s/"*$//')
    [[ -z "$name" ]] && name=$(grep -A5 '^\[project\]' "$toml" 2>/dev/null | grep '^name *=' | head -1 | sed 's/[^=]*= *"*//;s/"*$//')
    [[ -z "$name" ]] && name=$(basename "$PWD")
    echo "$name"
}

# =============================================================================
# COMMANDS
# =============================================================================

# Initialize .env file from tetra.toml [environments.<name>] section
tenv_init() {
    local env="${1:-}"
    local toml="./tetra.toml"

    if [[ ! -f "$toml" ]]; then
        echo "No tetra.toml in current directory"
        echo "Create one with [environments.<name>] sections"
        return 1
    fi

    if [[ -z "$env" ]]; then
        echo "Usage: tenv init <environment>"
        echo ""
        echo "Available environments:"
        _tenv_envs | sed 's/^/  /'
        return 1
    fi

    # Verify environment exists
    if ! grep -q "^\[environments\.$env\]" "$toml" 2>/dev/null; then
        echo "Environment not found: $env"
        echo ""
        echo "Available environments:"
        _tenv_envs | sed 's/^/  /'
        return 1
    fi

    local env_file="./env/${env}.env"
    local project=$(_tenv_project_name)

    # Check if file exists
    if [[ -f "$env_file" ]]; then
        echo "File exists: $env_file"
        read -p "Overwrite? (y/N): " -n 1 -r
        echo
        [[ ! $REPLY =~ ^[Yy]$ ]] && { echo "Cancelled"; return 1; }
    fi

    # Create env directory
    mkdir -p ./env

    # Extract section and generate .env file
    {
        echo "# Generated from tetra.toml [environments.$env]"
        echo "# Project: $project"
        echo "# Created: $(date -Iseconds)"
        echo ""
        echo "export TETRA_ENV=\"$env\""

        # Parse section and export all key=value pairs
        awk -v sect="environments.$env" '
            BEGIN { in_sect = 0 }
            /^\[/ {
                current = $0
                gsub(/[\[\]]/, "", current)
                in_sect = (current == sect)
                next
            }
            in_sect && /^[[:space:]]*[a-zA-Z_][a-zA-Z0-9_]*[[:space:]]*=/ {
                key = $0
                sub(/[[:space:]]*=.*/, "", key)
                sub(/^[[:space:]]*/, "", key)

                value = $0
                sub(/^[^=]*=[[:space:]]*/, "", value)
                gsub(/^"|"$/, "", value)

                upper_key = toupper(key)
                print "export " upper_key "=\"" value "\""
            }
        ' "$toml"
    } > "$env_file"

    echo "Created: $env_file"
    echo ""
    echo "Variables:"
    grep "^export" "$env_file" | sed 's/export /  /'
    echo ""
    echo "Usage: source $env_file"
}

# Validate .env file
tenv_validate() {
    local env="${1:-}"

    if [[ -z "$env" ]]; then
        echo "Usage: tenv validate <environment>"
        return 1
    fi

    local env_file="./env/${env}.env"

    if [[ ! -f "$env_file" ]]; then
        echo "File not found: $env_file"
        echo "Create with: tenv init $env"
        return 1
    fi

    echo "Validating: $env_file"
    echo ""

    local errors=0
    local warnings=0

    # Check for placeholder values
    if grep -qE "your_.*_here|your-.*-name|PLACEHOLDER.*_HERE|TODO|CHANGEME" "$env_file"; then
        echo "Error: Found placeholder values:"
        grep -E "your_.*_here|your-.*-name|PLACEHOLDER.*_HERE|TODO|CHANGEME" "$env_file" | head -5
        ((errors++))
    fi

    # Check for TETRA_ENV
    if ! grep -q "^export TETRA_ENV=" "$env_file"; then
        echo "Error: Missing TETRA_ENV"
        ((errors++))
    fi

    # Check for empty values
    if grep -qE '=""$' "$env_file"; then
        echo "Warning: Found empty values:"
        grep -E '=""$' "$env_file" | head -3
        ((warnings++))
    fi

    echo ""
    echo "Summary: $errors error(s), $warnings warning(s)"

    if [[ $errors -eq 0 ]]; then
        echo "Valid"
        return 0
    else
        echo "Invalid"
        return 1
    fi
}

# List .env files
tenv_list() {
    echo "Project: $(_tenv_project_name)"
    echo "Directory: ./env/"
    echo ""

    if [[ ! -d "./env" ]]; then
        echo "  (none - run 'tenv init <env>' to create)"
        return 0
    fi

    local found=0
    for f in ./env/*.env; do
        [[ -f "$f" ]] || continue
        local name=$(basename "$f" .env)
        local vars=$(grep -c "^export" "$f" 2>/dev/null || echo 0)
        printf "  %-12s %s (%d vars)\n" "$name" "$f" "$vars"
        ((found++))
    done

    [[ $found -eq 0 ]] && echo "  (none - run 'tenv init <env>' to create)"
}

# Show .env file contents
tenv_show() {
    local env="${1:-}"

    if [[ -z "$env" ]]; then
        echo "Usage: tenv show <environment>"
        return 1
    fi

    local env_file="./env/${env}.env"

    if [[ ! -f "$env_file" ]]; then
        echo "File not found: $env_file"
        return 1
    fi

    cat "$env_file"
}

# Help
tenv_help() {
    cat << 'EOF'
tenv - Project environment file manager

Works on ./tetra.toml in current directory.
Generates ./env/<environment>.env files.

COMMANDS
  init <env>       Generate ./env/<env>.env from tetra.toml
  validate <env>   Validate ./env/<env>.env for issues
  list             List ./env/*.env files
  show <env>       Display env file contents

EXAMPLE tetra.toml
  [service]
  name = "api-server"

  [environments.local]
  PORT = 8080
  DATABASE_URL = "postgres://localhost/dev"

  [environments.dev]
  PORT = 8080
  DATABASE_URL = "postgres://db.example.com/api"

USAGE
  cd ~/projects/api-server
  tenv init local
  source ./env/local.env
EOF
}

# =============================================================================
# MAIN
# =============================================================================

tenv() {
    case "${1:-}" in
        init)     tenv_init "$2" ;;
        validate) tenv_validate "$2" ;;
        list)     tenv_list ;;
        show)     tenv_show "$2" ;;
        help|-h|--help) tenv_help ;;
        *)        tenv_help ;;
    esac
}

# Tab completion
_tenv_complete() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local cmd="${COMP_WORDS[1]:-}"

    if [[ $COMP_CWORD -eq 1 ]]; then
        COMPREPLY=($(compgen -W "init validate list show help" -- "$cur"))
        return
    fi

    if [[ $COMP_CWORD -eq 2 ]]; then
        case "$cmd" in
            init|validate|show)
                COMPREPLY=($(compgen -W "$(_tenv_envs)" -- "$cur"))
                ;;
        esac
    fi
}

complete -F _tenv_complete tenv

# Export
export -f tenv tenv_init tenv_validate tenv_list tenv_show tenv_help
export -f _tenv_envs _tenv_project_name
