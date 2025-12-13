#!/usr/bin/env bash
# deploy_engine.sh - File-centric deployment engine
#
# Parses tetra-deploy.toml and executes pipelines.
#
# Usage:
#   de_load <toml_file>              # Load and parse TOML
#   de_run <pipeline> <env>          # Execute pipeline
#   de_pipelines                     # List available pipelines
#   de_files                         # List file sets

# =============================================================================
# STATE
# =============================================================================

# Parsed TOML data stored in associative arrays
declare -gA DE_TARGET=()       # [target] section
declare -gA DE_ENV=()          # [env.*] sections (flattened)
declare -gA DE_FILES=()        # [files] section
declare -gA DE_BUILD=()        # [build.*] sections
declare -gA DE_SYNC=()         # [sync] section
declare -gA DE_PIPELINE=()     # [pipeline] section
declare -gA DE_ALIAS=()        # [alias] section
declare -gA DE_HISTORY=()      # [history] section

DE_TOML=""                     # Current TOML file path
DE_TOML_DIR=""                 # Directory containing TOML

# =============================================================================
# TOML PARSING
# =============================================================================

_de_clear() {
    DE_TARGET=()
    DE_ENV=()
    DE_FILES=()
    DE_BUILD=()
    DE_SYNC=()
    DE_PIPELINE=()
    DE_ALIAS=()
    DE_HISTORY=()
    DE_TOML=""
    DE_TOML_DIR=""
}

_de_parse_value() {
    local line="$1"
    local val="${line#*=}"
    val="${val#"${val%%[![:space:]]*}"}"
    val="${val%"${val##*[![:space:]]}"}"
    val="${val#\"}"
    val="${val%\"}"
    val="${val#\'}"
    val="${val%\'}"
    echo "$val"
}

_de_parse_array() {
    local line="$1"
    local val="${line#*=}"
    val="${val#*\[}"
    val="${val%\]*}"
    echo "$val" | tr ',' '\n' | while read -r item; do
        item="${item#"${item%%[![:space:]]*}"}"
        item="${item%"${item##*[![:space:]]}"}"
        item="${item#\"}"
        item="${item%\"}"
        [[ -n "$item" ]] && echo "$item"
    done | tr '\n' ' ' | sed 's/ $//'
}

de_load() {
    local toml="$1"

    if [[ ! -f "$toml" ]]; then
        echo "File not found: $toml" >&2
        return 1
    fi

    _de_clear
    DE_TOML="$toml"
    DE_TOML_DIR=$(dirname "$toml")

    local section=""
    local subsection=""

    while IFS= read -r line || [[ -n "$line" ]]; do
        [[ "$line" =~ ^[[:space:]]*# ]] && continue
        [[ -z "${line// }" ]] && continue

        if [[ "$line" =~ ^\[([a-zA-Z0-9._-]+)\] ]]; then
            local full="${BASH_REMATCH[1]}"
            if [[ "$full" == *.* ]]; then
                section="${full%%.*}"
                subsection="${full#*.}"
            else
                section="$full"
                subsection=""
            fi
            continue
        fi

        if [[ "$line" =~ ^([a-zA-Z_][a-zA-Z0-9_-]*)[[:space:]]*= ]]; then
            local key="${BASH_REMATCH[1]}"
            local val

            if [[ "$line" == *"["* ]]; then
                val=$(_de_parse_array "$line")
            else
                val=$(_de_parse_value "$line")
            fi

            case "$section" in
                target)   DE_TARGET["$key"]="$val" ;;
                env)      DE_ENV["$subsection.$key"]="$val" ;;
                files)
                    if [[ -n "$subsection" ]]; then
                        DE_FILES["$subsection.$key"]="$val"
                    else
                        DE_FILES["$key"]="$val"
                    fi
                    ;;
                build)
                    if [[ -n "$subsection" ]]; then
                        DE_BUILD["$subsection.$key"]="$val"
                    else
                        DE_BUILD["$key"]="$val"
                    fi
                    ;;
                sync)     DE_SYNC["$key"]="$val" ;;
                pipeline) DE_PIPELINE["$key"]="$val" ;;
                alias)    DE_ALIAS["$key"]="$val" ;;
                history)  DE_HISTORY["$key"]="$val" ;;
            esac
        fi
    done < "$toml"

    return 0
}

# =============================================================================
# TEMPLATE SUBSTITUTION
# =============================================================================

_de_template() {
    local str="$1"
    local env="$2"
    local files="${3:-}"

    local ssh="${DE_ENV["$env.ssh"]}"
    local user="${DE_ENV["$env.user"]}"
    local domain="${DE_ENV["$env.domain"]}"

    local inherit="${DE_ENV["$env.inherit"]}"
    if [[ -n "$inherit" ]]; then
        [[ -z "$ssh" ]] && ssh="${DE_ENV["$inherit.ssh"]}"
        [[ -z "$user" ]] && user="${DE_ENV["$inherit.user"]}"
        [[ -z "$domain" ]] && domain="${DE_ENV["$inherit.domain"]}"
    fi

    # Resolve cwd (may contain {{user}})
    local cwd="${DE_TARGET[cwd]}"
    cwd="${cwd//\{\{user\}\}/$user}"

    str="${str//\{\{ssh\}\}/$ssh}"
    str="${str//\{\{user\}\}/$user}"
    str="${str//\{\{domain\}\}/$domain}"
    str="${str//\{\{env\}\}/$env}"
    str="${str//\{\{name\}\}/${DE_TARGET[name]}}"
    str="${str//\{\{source\}\}/${DE_TARGET[source]}}"
    str="${str//\{\{cwd\}\}/$cwd}"
    str="${str//\{\{files\}\}/$files}"
    str="${str//\{\{timestamp\}\}/$(date -Iseconds)}"

    echo "$str"
}

# =============================================================================
# FILE RESOLUTION
# =============================================================================

_de_resolve_files() {
    local name="$1"

    local include="${DE_FILES["$name.include"]}"
    if [[ -n "$include" ]]; then
        local result=""
        for ref in $include; do
            local resolved=$(_de_resolve_files "$ref")
            result="$result $resolved"
        done
        echo "${result# }"
        return
    fi

    echo "${DE_FILES[$name]}"
}

# =============================================================================
# EXECUTION
# =============================================================================

_de_exec_build() {
    local name="$1"
    local env="$2"
    local dry_run="${3:-0}"

    local cmd="${DE_BUILD["$name.command"]}"
    [[ -z "$cmd" ]] && cmd="${DE_BUILD[$name]}"

    if [[ -z "$cmd" ]]; then
        echo "  [skip] build:$name (not defined)" >&2
        return 0
    fi

    local pre="${DE_BUILD[pre]}"
    if [[ -n "$pre" && -z "$_DE_PRE_RAN" ]]; then
        echo "  [pre] $pre"
        if [[ "$dry_run" -eq 0 ]]; then
            (cd "$DE_TOML_DIR" && eval "$pre") || return 1
        fi
        _DE_PRE_RAN=1
    fi

    cmd=$(_de_template "$cmd" "$env")
    echo "  [build:$name] $cmd"

    if [[ "$dry_run" -eq 0 ]]; then
        (cd "$DE_TOML_DIR" && eval "$cmd") || return 1
    fi
}

_de_exec_sync() {
    local env="$1"
    local files="${2:-}"
    local dry_run="${3:-0}"

    local method="${DE_SYNC[method]:-rsync}"
    local options="${DE_SYNC[options]:--avz}"
    local chown="${DE_SYNC[chown]}"
    local chmod="${DE_SYNC[chmod]}"
    local delete="${DE_SYNC[delete]}"

    local ssh=$(_de_template "{{ssh}}" "$env")
    local cwd=$(_de_template "{{cwd}}" "$env")
    local source="${DE_TARGET[source]}"

    local cmd="rsync $options"
    [[ "$delete" == "true" ]] && cmd="$cmd --delete"
    [[ -n "$chown" ]] && cmd="$cmd --chown=$chown"

    if [[ -n "$files" && "$files" != "*.html" && "$files" != "*" ]]; then
        for f in $files; do
            cmd="$cmd ${source}$f"
        done
        cmd="$cmd $ssh:$cwd/"
    else
        cmd="$cmd ${source} $ssh:$cwd/"
    fi

    echo "  [sync] $cmd"

    if [[ "$dry_run" -eq 0 ]]; then
        (cd "$DE_TOML_DIR" && eval "$cmd") || return 1

        if [[ -n "$chmod" ]]; then
            local chmod_cmd="ssh $ssh chmod -R $chmod $cwd"
            echo "  [chmod] $chmod_cmd"
            eval "$chmod_cmd" || return 1
        fi
    fi
}

de_run() {
    local pipeline="${1:-default}"
    local env="$2"
    local dry_run="${3:-0}"

    local resolved="${DE_ALIAS[$pipeline]}"
    [[ -n "$resolved" ]] && pipeline="$resolved"

    local steps="${DE_PIPELINE[$pipeline]}"
    if [[ -z "$steps" ]]; then
        echo "Pipeline not found: $pipeline" >&2
        echo "Available: $(de_pipelines)" >&2
        return 1
    fi

    local ssh="${DE_ENV["$env.ssh"]}"
    local inherit="${DE_ENV["$env.inherit"]}"
    [[ -z "$ssh" && -n "$inherit" ]] && ssh="${DE_ENV["$inherit.ssh"]}"

    if [[ -z "$ssh" ]]; then
        echo "Environment not found: $env" >&2
        return 1
    fi

    local confirm="${DE_ENV["$env.confirm"]}"
    if [[ "$confirm" == "true" && "$dry_run" -eq 0 ]]; then
        echo "Deploy ${DE_TARGET[name]}:$pipeline -> $env"
        echo "  SSH: $ssh"
        echo "  CWD: $(_de_template "{{cwd}}" "$env")"
        read -rp "Proceed? [y/N] " ans
        [[ "$ans" != "y" && "$ans" != "Y" ]] && { echo "Cancelled"; return 1; }
    fi

    echo "========================================"
    echo "Deploy: ${DE_TARGET[name]}:$pipeline -> $env"
    [[ "$dry_run" -eq 1 ]] && echo "[DRY RUN]"
    echo "========================================"

    _DE_PRE_RAN=""
    local start_time=$SECONDS

    for step in $steps; do
        case "$step" in
            build:*)
                local build_name="${step#build:}"
                _de_exec_build "$build_name" "$env" "$dry_run" || return 1
                ;;
            sync)
                local files=$(_de_resolve_files "${pipeline}")
                [[ -z "$files" ]] && files=$(_de_resolve_files "all")
                _de_exec_sync "$env" "$files" "$dry_run" || return 1
                ;;
            *)
                echo "  [unknown step] $step" >&2
                ;;
        esac
    done

    local duration=$((SECONDS - start_time))
    echo "========================================"
    echo "Done (${duration}s)"
    echo "========================================"

    if [[ "$dry_run" -eq 0 ]] && type _deploy_log &>/dev/null; then
        _deploy_log "${DE_TARGET[name]}:$pipeline" "$env" "push" "success" "$duration"
    fi
}

# =============================================================================
# LISTING
# =============================================================================

de_pipelines() {
    local result=""
    for key in "${!DE_PIPELINE[@]}"; do
        result="$result $key"
    done
    for key in "${!DE_ALIAS[@]}"; do
        result="$result $key"
    done
    echo "${result# }"
}

de_files() {
    for key in "${!DE_FILES[@]}"; do
        [[ "$key" != *.* ]] && echo "$key"
    done
}

de_envs() {
    local seen=""
    for key in "${!DE_ENV[@]}"; do
        local env="${key%%.*}"
        [[ "$seen" != *" $env "* ]] && { seen="$seen $env "; echo "$env"; }
    done
}

de_show() {
    echo "Target: ${DE_TARGET[name]}"
    echo "Source: ${DE_TARGET[source]}"
    echo "CWD:    ${DE_TARGET[cwd]}"
    echo ""
    echo "Files:     $(de_files | tr '\n' ' ')"
    echo "Pipelines: $(de_pipelines)"
    echo "Envs:      $(de_envs | tr '\n' ' ')"
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f de_load de_run de_show de_pipelines de_files de_envs
export -f _de_clear _de_parse_value _de_parse_array
export -f _de_template _de_resolve_files
export -f _de_exec_build _de_exec_sync
