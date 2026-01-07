#!/usr/bin/env bash
# tsm/core/build.sh - Build .tsm files from env.toml
#
# Usage:
#   tsm build           Build all envs from ./tsm/env.toml
#   tsm build local     Build specific env
#   tsm build -n        Dry run
#
# Looks for env.toml in:
#   1. ./tsm/env.toml (preferred)
#   2. ./env.toml (fallback)
#
# Output: .tsm files collocated with env.toml

# =============================================================================
# TOML PARSER
# =============================================================================

# Parse env.toml and set variables via nameref
# Usage: _tsm_parse_toml <file> <target_env> name command description org cwd shared_assoc env_assoc secrets_assoc
_tsm_parse_toml() {
    local file="$1"
    local target_env="$2"
    local -n _name="$3"
    local -n _command="$4"
    local -n _description="$5"
    local -n _org="$6"
    local -n _cwd="$7"
    local -n _shared="$8"
    local -n _env="$9"
    local -n _secrets="${10}"

    local current_section=""
    local in_target_env=false

    while IFS= read -r line || [[ -n "$line" ]]; do
        # Skip empty lines and comments
        [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue

        # Trim whitespace
        line="${line#"${line%%[![:space:]]*}"}"
        line="${line%"${line##*[![:space:]]}"}"

        # Section header: [name]
        if [[ "$line" =~ ^\[([a-zA-Z_][a-zA-Z0-9_-]*)\]$ ]]; then
            current_section="${BASH_REMATCH[1]}"
            in_target_env=false
            [[ "$current_section" == "$target_env" ]] && in_target_env=true
            continue
        fi

        # Key = "value" or key = 'value' or key = value
        if [[ "$line" =~ ^([a-zA-Z_][a-zA-Z0-9_]*)[[:space:]]*=[[:space:]]*(.+)$ ]]; then
            local key="${BASH_REMATCH[1]}"
            local val="${BASH_REMATCH[2]}"

            # Strip quotes
            val="${val#\"}" ; val="${val%\"}"
            val="${val#\'}" ; val="${val%\'}"

            case "$current_section" in
                service)
                    case "$key" in
                        name) _name="$val" ;;
                        command) _command="$val" ;;
                        description) _description="$val" ;;
                        org) _org="$val" ;;
                    esac
                    ;;
                shared)
                    _shared["$key"]="$val"
                    ;;
                secrets)
                    _secrets["$key"]="$val"
                    ;;
                *)
                    if [[ "$in_target_env" == "true" ]]; then
                        if [[ "$key" == "cwd" ]]; then
                            _cwd="$val"
                        else
                            _env["$key"]="$val"
                        fi
                    fi
                    ;;
            esac
        fi
    done < "$file"

    return 0
}

# List all environment sections in env.toml
# Usage: _tsm_list_envs <toml_file>
_tsm_list_envs() {
    local file="$1"
    local -a envs=()
    local skip_sections="service shared secrets"

    while IFS= read -r line; do
        if [[ "$line" =~ ^\[([a-zA-Z_][a-zA-Z0-9_-]*)\]$ ]]; then
            local section="${BASH_REMATCH[1]}"
            # Skip non-env sections
            [[ " $skip_sections " == *" $section "* ]] && continue
            envs+=("$section")
        fi
    done < "$file"

    printf '%s\n' "${envs[@]}"
}

# =============================================================================
# BUILD
# =============================================================================

# Build .tsm file for a single environment
# Usage: _tsm_build_env <toml_file> <env> <output_dir> [--dry-run]
_tsm_build_env() {
    local toml_file="$1"
    local env="$2"
    local output_dir="$3"
    local dry_run="${4:-}"

    # Parse env.toml
    local name="" command="" description="" org="" cwd=""
    local -A shared_vars env_vars secrets_vars

    _tsm_parse_toml "$toml_file" "$env" \
        name command description org cwd \
        shared_vars env_vars secrets_vars || return 1

    # Validate required fields
    if [[ -z "$name" ]]; then
        tsm_error "Missing [service] name in env.toml"
        return 1
    fi
    if [[ -z "$command" ]]; then
        tsm_error "Missing [service] command in env.toml"
        return 1
    fi

    # Determine org for secrets resolution
    [[ -z "$org" ]] && org="${TETRA_ORG:-tetra}"

    # Load org secrets for variable expansion
    local secrets_file="$TETRA_DIR/orgs/$org/secrets.env"
    if [[ -f "$secrets_file" ]]; then
        set -a; source "$secrets_file"; set +a
    fi

    # Merge: shared + env-specific (env overrides shared)
    local -A merged_vars
    for key in "${!shared_vars[@]}"; do
        merged_vars["$key"]="${shared_vars[$key]}"
    done
    for key in "${!env_vars[@]}"; do
        merged_vars["$key"]="${env_vars[$key]}"
    done

    # Resolve secrets ($VAR → actual value)
    for key in "${!secrets_vars[@]}"; do
        local val="${secrets_vars[$key]}"
        if [[ "$val" == \$* ]]; then
            local var_name="${val#\$}"
            var_name="${var_name#\{}"
            var_name="${var_name%\}}"
            merged_vars["$key"]="${!var_name:-}"
        else
            merged_vars["$key"]="$val"
        fi
    done

    # Get PORT and CWD
    local port="${merged_vars[PORT]:-${env_vars[PORT]:-8080}}"
    [[ -z "$cwd" ]] && cwd="${env_vars[cwd]:-${merged_vars[cwd]:-\$PWD}}"

    # Output file
    local output_file="$output_dir/${name}-${env}.tsm"

    # Generate .tsm content
    local content=""
    content+="#!/usr/bin/env bash"$'\n'
    content+="# Generated from env.toml [$env] - do not edit"$'\n'
    content+="# Regenerate: tsm build $env"$'\n'
    content+="# Source: $toml_file"$'\n'
    content+=""$'\n'
    content+="TSM_NAME=\"${name}-${env}\""$'\n'
    content+="TSM_COMMAND=\"$command\""$'\n'
    content+="TSM_PORT=$port"$'\n'
    content+="TSM_CWD=\"$cwd\""$'\n'
    [[ -n "$description" ]] && content+="TSM_DESCRIPTION=\"$description\""$'\n'
    content+=""$'\n'
    content+="# Environment variables"$'\n'

    # Sort keys for consistent output
    local sorted_keys=($(echo "${!merged_vars[@]}" | tr ' ' '\n' | sort))
    for key in "${sorted_keys[@]}"; do
        local val="${merged_vars[$key]}"
        # Skip cwd - it's TSM_CWD
        [[ "$key" == "cwd" ]] && continue
        content+="export ${key}=\"${val}\""$'\n'
    done

    if [[ "$dry_run" == "--dry-run" || "$dry_run" == "-n" ]]; then
        echo "=== DRY RUN: $env ==="
        echo "Would write: $output_file"
        echo ""
        echo "$content"
        return 0
    fi

    # Write file
    echo "$content" > "$output_file"
    chmod 755 "$output_file"

    echo "  $env → ${name}-${env}.tsm"
}

# Main build command
# Usage: tsm_build [path/to/env.toml] [env] [-o output_dir] [--dry-run]
#
# Examples:
#   tsm build                           Build all envs from ./tsm/env.toml
#   tsm build local                     Build specific env
#   tsm build project/tsm/env.toml dev  Build dev from specified path
#   tsm build -o ~/target               Build to custom output directory
#   tsm build -n                        Dry run
tsm_build() {
    local env=""
    local dry_run=""
    local toml_file=""
    local output_dir=""

    # Parse args
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -n|--dry-run) dry_run="--dry-run"; shift ;;
            -o|--output)
                shift
                output_dir="$1"
                shift
                ;;
            -*)
                tsm_error "Unknown option: $1"
                return 1
                ;;
            *)
                # First positional: could be toml path or env name
                if [[ -z "$toml_file" && "$1" == *.toml ]]; then
                    toml_file="$1"
                elif [[ -z "$toml_file" && -f "$1" ]]; then
                    toml_file="$1"
                elif [[ -z "$env" ]]; then
                    env="$1"
                fi
                shift
                ;;
        esac
    done

    # Find env.toml if not specified
    if [[ -z "$toml_file" ]]; then
        if [[ -f "./tsm/env.toml" ]]; then
            toml_file="./tsm/env.toml"
        elif [[ -f "./env.toml" ]]; then
            toml_file="./env.toml"
        else
            tsm_error "No env.toml found (checked ./tsm/env.toml and ./env.toml)"
            tsm_error "Usage: tsm build [path/to/env.toml] [env] [-o output_dir]"
            return 1
        fi
    fi

    # Validate toml_file exists
    if [[ ! -f "$toml_file" ]]; then
        tsm_error "File not found: $toml_file"
        return 1
    fi

    # Default output_dir to same directory as toml_file
    if [[ -z "$output_dir" ]]; then
        output_dir=$(dirname "$toml_file")
    fi

    # Create output_dir if it doesn't exist
    if [[ ! -d "$output_dir" ]]; then
        mkdir -p "$output_dir" || {
            tsm_error "Cannot create output directory: $output_dir"
            return 1
        }
    fi

    echo "Building from: $toml_file"
    echo "Output to:     $output_dir"
    [[ -n "$dry_run" ]] && echo "[DRY RUN]"
    echo ""

    if [[ -n "$env" ]]; then
        # Build single env
        _tsm_build_env "$toml_file" "$env" "$output_dir" "$dry_run"
    else
        # Build all envs
        local envs
        envs=$(_tsm_list_envs "$toml_file")

        if [[ -z "$envs" ]]; then
            tsm_error "No environment sections found in $toml_file"
            return 1
        fi

        for e in $envs; do
            _tsm_build_env "$toml_file" "$e" "$output_dir" "$dry_run"
        done
    fi

    echo ""
    echo "Done"
}

export -f tsm_build _tsm_build_env _tsm_parse_toml _tsm_list_envs
