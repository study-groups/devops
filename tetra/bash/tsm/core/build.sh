#!/usr/bin/env bash
# tsm/core/build.sh - Build .tsm files from env.toml
#
# Usage:
#   tsm build <env> [env...]   Build specified env(s)
#   tsm build dev staging prod Build multiple envs
#   tsm build -n dev           Dry run
#
# Looks for env.toml in:
#   1. ./tsm/env.toml (preferred)
#   2. ./env.toml (fallback)
#
# Output: .tsm files collocated with env.toml
#
# Inheritance: local → dev → staging → prod (implicit)
#   Each env inherits from previous unless explicit `inherit = "..."` is set

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

# Get a single value from a TOML section
# Usage: _tsm_toml_get <file> <section> <key>
_tsm_toml_get() {
    local file="$1"
    local section="$2"
    local key="$3"
    local in_section=false

    while IFS= read -r line || [[ -n "$line" ]]; do
        # Skip empty lines and comments
        [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue

        # Trim whitespace
        line="${line#"${line%%[![:space:]]*}"}"
        line="${line%"${line##*[![:space:]]}"}"

        # Section header
        if [[ "$line" =~ ^\[([a-zA-Z_][a-zA-Z0-9_-]*)\]$ ]]; then
            [[ "${BASH_REMATCH[1]}" == "$section" ]] && in_section=true || in_section=false
            continue
        fi

        # Key = value (only if in target section)
        if [[ "$in_section" == "true" && "$line" =~ ^${key}[[:space:]]*=[[:space:]]*(.+)$ ]]; then
            local val="${BASH_REMATCH[1]}"
            # Strip quotes
            val="${val#\"}" ; val="${val%\"}"
            val="${val#\'}" ; val="${val%\'}"
            echo "$val"
            return 0
        fi
    done < "$file"

    return 1
}

# =============================================================================
# INHERITANCE
# =============================================================================

# Build the inheritance chain for an env
# Returns env names in order (ancestor first, target last)
# Usage: _tsm_build_chain <toml_file> <env>
_tsm_build_chain() {
    local toml="$1"
    local env="$2"

    # Check for explicit inherit in this env's section
    local explicit
    explicit=$(_tsm_toml_get "$toml" "$env" "inherit")

    if [[ -n "$explicit" ]]; then
        # Explicit: recurse from that parent, then add self
        _tsm_build_chain "$toml" "$explicit"
        echo "$env"
    else
        # Implicit chain: local → dev → staging → prod
        case "$env" in
            local)   echo "local" ;;
            dev)     echo "local"; echo "dev" ;;
            staging) echo "local"; echo "dev"; echo "staging" ;;
            prod)    echo "local"; echo "dev"; echo "staging"; echo "prod" ;;
            *)       echo "local"; echo "$env" ;;  # unknown env inherits from local
        esac
    fi
}

# Merge a section's key-value pairs into an associative array
# Usage: _tsm_merge_section <toml_file> <section> <assoc_array_nameref>
_tsm_merge_section() {
    local file="$1"
    local section="$2"
    local -n _target="$3"
    local in_section=false

    while IFS= read -r line || [[ -n "$line" ]]; do
        [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue

        line="${line#"${line%%[![:space:]]*}"}"
        line="${line%"${line##*[![:space:]]}"}"

        if [[ "$line" =~ ^\[([a-zA-Z_][a-zA-Z0-9_-]*)\]$ ]]; then
            [[ "${BASH_REMATCH[1]}" == "$section" ]] && in_section=true || in_section=false
            continue
        fi

        if [[ "$in_section" == "true" && "$line" =~ ^([a-zA-Z_][a-zA-Z0-9_]*)[[:space:]]*=[[:space:]]*(.+)$ ]]; then
            local key="${BASH_REMATCH[1]}"
            local val="${BASH_REMATCH[2]}"
            val="${val#\"}" ; val="${val%\"}"
            val="${val#\'}" ; val="${val%\'}"
            # Skip 'inherit' key - it's metadata, not a var
            [[ "$key" == "inherit" ]] && continue
            _target["$key"]="$val"
        fi
    done < "$file"
}

# Resolve all vars for an env with inheritance
# Usage: _tsm_resolve_env <toml_file> <env> <result_assoc_nameref>
_tsm_resolve_env() {
    local toml="$1"
    local env="$2"
    local -n _result="$3"

    # Build inheritance chain
    local -a chain
    mapfile -t chain < <(_tsm_build_chain "$toml" "$env")

    # Merge: shared first, then chain in order (later overrides earlier)
    _tsm_merge_section "$toml" "shared" _result
    for e in "${chain[@]}"; do
        _tsm_merge_section "$toml" "$e" _result
    done
}

# =============================================================================
# BUILD
# =============================================================================

# Build .tsm file for a single environment (with inheritance)
# Usage: _tsm_build_env <toml_file> <env> <output_dir> [--dry-run]
_tsm_build_env() {
    local toml_file="$1"
    local env="$2"
    local output_dir="$3"
    local dry_run="${4:-}"

    # Get service metadata
    local name command description org
    name=$(_tsm_toml_get "$toml_file" "service" "name")
    command=$(_tsm_toml_get "$toml_file" "service" "command")
    description=$(_tsm_toml_get "$toml_file" "service" "description")
    org=$(_tsm_toml_get "$toml_file" "service" "org")

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

    # Resolve env vars with inheritance (shared + chain)
    local -A merged_vars
    _tsm_resolve_env "$toml_file" "$env" merged_vars

    # Resolve secrets ($VAR → actual value)
    local -A secrets_vars
    _tsm_merge_section "$toml_file" "secrets" secrets_vars
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

    # Get PORT and CWD from merged vars
    local port="${merged_vars[PORT]:-8080}"

    # Resolve CWD - must be absolute path at build time
    local cwd="${merged_vars[cwd]:-}"
    local toml_dir
    toml_dir="$(cd "$(dirname "$toml_file")" && pwd)"
    local project_dir
    project_dir="$(dirname "$toml_dir")"  # parent of tsm/ dir

    if [[ -z "$cwd" ]]; then
        # Default: project directory (parent of tsm/)
        cwd="$project_dir"
    elif [[ "$cwd" != /* ]]; then
        # Relative path: resolve from project dir
        cwd="$(cd "$project_dir" && cd "$cwd" 2>/dev/null && pwd)" || cwd="$project_dir/$cwd"
    fi

    # Pre-resolve path-like variables (TSM_DIR, etc.) to absolute paths
    # These are common patterns that should be resolved at build time
    local -A resolved_vars
    for key in "${!merged_vars[@]}"; do
        local val="${merged_vars[$key]}"
        # Resolve paths that look relative (start with . or ..)
        if [[ "$val" == ./* || "$val" == ../* || "$val" == "." || "$val" == ".." ]]; then
            resolved_vars["$key"]="$(cd "$project_dir" && cd "$val" 2>/dev/null && pwd)" || resolved_vars["$key"]="$project_dir/$val"
        else
            resolved_vars["$key"]="$val"
        fi
    done

    # Substitute $VAR with resolved values in command
    local resolved_command="$command"
    for key in "${!resolved_vars[@]}"; do
        local val="${resolved_vars[$key]}"
        # Handle both $VAR and ${VAR} forms
        resolved_command="${resolved_command//\$\{$key\}/$val}"
        resolved_command="${resolved_command//\$$key/$val}"
    done

    # Output file
    local output_file="$output_dir/${name}-${env}.tsm"

    # Show inheritance chain in dry-run
    local chain_str
    chain_str=$(_tsm_build_chain "$toml_file" "$env" | tr '\n' ' ')

    # Generate .tsm content
    local content=""
    content+="#!/usr/bin/env bash"$'\n'
    content+="# Generated from env.toml [$env] - do not edit"$'\n'
    content+="# Regenerate: tsm build $env"$'\n'
    content+="# Source: $toml_file"$'\n'
    content+="# Inheritance: ${chain_str}"$'\n'
    content+=""$'\n'
    content+="TSM_NAME=\"${name}-${env}\""$'\n'
    content+="TSM_COMMAND=\"$resolved_command\""$'\n'
    content+="TSM_PORT=$port"$'\n'
    content+="TSM_CWD=\"$cwd\""$'\n'
    [[ -n "$description" ]] && content+="TSM_DESCRIPTION=\"$description\""$'\n'
    content+=""$'\n'
    content+="# Environment variables"$'\n'

    # Sort keys for consistent output (use resolved_vars for absolute paths)
    local sorted_keys=($(echo "${!resolved_vars[@]}" | tr ' ' '\n' | sort))
    for key in "${sorted_keys[@]}"; do
        local val="${resolved_vars[$key]}"
        # Skip cwd - it's TSM_CWD
        [[ "$key" == "cwd" ]] && continue
        content+="export ${key}=\"${val}\""$'\n'
    done

    if [[ "$dry_run" == "--dry-run" || "$dry_run" == "-n" ]]; then
        echo "=== DRY RUN: $env ==="
        echo "Inheritance: ${chain_str}"
        echo "Would write: $output_file"
        echo ""
        echo "$content"
        return 0
    fi

    # Write file
    echo "$content" > "$output_file"
    chmod 755 "$output_file"

    echo "  $env → ${name}-${env}.tsm (chain: ${chain_str})"
}

# Main build command
# Usage: tsm_build <env> [env...] [-o output_dir] [--dry-run]
#
# Examples:
#   tsm build dev                       Build dev env
#   tsm build dev staging prod          Build multiple envs
#   tsm build -n prod                   Dry run for prod
#   tsm build -o ~/target dev           Build to custom output directory
#
# Requires explicit env argument(s) - no magic "build all"
tsm_build() {
    local -a envs=()
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
            -h|--help)
                echo "Usage: tsm build <env> [env...] [-n] [-o dir]"
                echo ""
                echo "Build .tsm files from env.toml with inheritance."
                echo ""
                echo "Arguments:"
                echo "  <env>          Environment(s) to build (required)"
                echo "                 Standard: local, dev, staging, prod"
                echo ""
                echo "Options:"
                echo "  -n, --dry-run  Show what would be built without writing"
                echo "  -o, --output   Output directory (default: same as env.toml)"
                echo ""
                echo "Inheritance chain: local → dev → staging → prod"
                echo "Use 'inherit = \"env\"' in section to override"
                return 0
                ;;
            -*)
                tsm_error "Unknown option: $1"
                tsm_error "Usage: tsm build <env> [env...] [-n] [-o dir]"
                return 1
                ;;
            *)
                # Check if it's a toml file path
                if [[ -z "$toml_file" && "$1" == *.toml ]]; then
                    toml_file="$1"
                elif [[ -z "$toml_file" && -f "$1" && "$1" != "local" && "$1" != "dev" && "$1" != "staging" && "$1" != "prod" ]]; then
                    toml_file="$1"
                else
                    # It's an env name
                    envs+=("$1")
                fi
                shift
                ;;
        esac
    done

    # Require at least one env
    if [[ ${#envs[@]} -eq 0 ]]; then
        tsm_error "Usage: tsm build <env> [env...]"
        tsm_error ""
        tsm_error "Specify environment(s): local, dev, staging, prod"
        tsm_error "Example: tsm build dev"
        tsm_error "Example: tsm build dev staging prod"
        return 1
    fi

    # Find env.toml if not specified
    if [[ -z "$toml_file" ]]; then
        if [[ -f "./tsm/env.toml" ]]; then
            toml_file="./tsm/env.toml"
        elif [[ -f "./env.toml" ]]; then
            toml_file="./env.toml"
        else
            tsm_error "No env.toml found (checked ./tsm/env.toml and ./env.toml)"
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
    echo "Environments:  ${envs[*]}"
    [[ -n "$dry_run" ]] && echo "[DRY RUN]"
    echo ""

    # Build each specified env
    local rc=0
    for env in "${envs[@]}"; do
        _tsm_build_env "$toml_file" "$env" "$output_dir" "$dry_run" || rc=1
    done

    echo ""
    [[ $rc -eq 0 ]] && echo "Done" || echo "Done (with errors)"
    return $rc
}

