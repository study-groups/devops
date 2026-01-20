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
# OUTPUT FORMATTING
# =============================================================================

_de_init_colors() {
    if type tds_text_color &>/dev/null; then
        DE_CLR_HEAD=$(tds_text_color "content.heading.h1")
        DE_CLR_STEP=$(tds_text_color "content.heading.h2")
        DE_CLR_CMD=$(tds_text_color "action.primary")
        DE_CLR_FILE=$(tds_text_color "action.secondary")
        DE_CLR_DIM=$(tds_text_color "text.muted")
        DE_CLR_OK=$(tds_text_color "status.success")
        DE_CLR_WARN=$(tds_text_color "status.warning")
        DE_CLR_NC=$(reset_color)
    else
        DE_CLR_HEAD='\033[1;36m'    # Cyan bold
        DE_CLR_STEP='\033[0;33m'    # Yellow
        DE_CLR_CMD='\033[0;37m'     # White
        DE_CLR_FILE='\033[0;32m'    # Green
        DE_CLR_DIM='\033[0;90m'     # Gray
        DE_CLR_OK='\033[0;32m'      # Green
        DE_CLR_WARN='\033[0;33m'    # Yellow
        DE_CLR_NC='\033[0m'         # Reset
    fi
}

# Format file size human-readable
_de_format_size() {
    local bytes="$1"
    if [[ $bytes -ge 1048576 ]]; then
        printf "%.1fM" "$(echo "scale=1; $bytes/1048576" | bc)"
    elif [[ $bytes -ge 1024 ]]; then
        printf "%.1fK" "$(echo "scale=1; $bytes/1024" | bc)"
    else
        printf "%dB" "$bytes"
    fi
}

# Print command with smart wrapping based on terminal width
# Usage: _de_print_cmd <prefix> <command>
_de_print_cmd() {
    local prefix="$1"
    local cmd="$2"
    local width=${COLUMNS:-80}

    # Ensure minimum usable width
    (( width < 40 )) && width=40

    # Small fixed indent for continuations (6 spaces)
    local indent="      "
    local first_indent="   "  # 3 spaces for first line

    # Calculate max line lengths (reserve space for backslash + space)
    local max_first=$((width - ${#first_indent} - ${#prefix} - 3))
    local max_cont=$((width - ${#indent} - 3))

    # Ensure we have reasonable space for content
    (( max_first < 20 )) && max_first=20
    (( max_cont < 20 )) && max_cont=20

    # If it fits, just print it
    if [[ ${#cmd} -le $max_first ]]; then
        echo -e "  ${DE_CLR_STEP}${prefix}${DE_CLR_NC} ${DE_CLR_CMD}${cmd}${DE_CLR_NC}"
        return
    fi

    # Collect all words, then build wrapped lines
    local -a words=()
    read -ra words <<< "$cmd"

    local line=""
    local first=1
    local i=0
    local total=${#words[@]}

    while (( i < total )); do
        local word="${words[i]}"
        local test_line="${line:+$line }$word"
        local max=$max_first
        (( first == 0 )) && max=$max_cont

        if [[ ${#test_line} -gt $max && -n "$line" ]]; then
            # Print current line with continuation backslash
            if (( first == 1 )); then
                echo -e "  ${DE_CLR_STEP}${prefix}${DE_CLR_NC} ${DE_CLR_CMD}${line}${DE_CLR_NC} ${DE_CLR_DIM}\\\\${DE_CLR_NC}"
                first=0
            else
                echo -e "${DE_CLR_CMD}${indent}${line}${DE_CLR_NC} ${DE_CLR_DIM}\\\\${DE_CLR_NC}"
            fi
            line="$word"
        else
            line="$test_line"
        fi
        (( i++ ))
    done

    # Print final line (no backslash)
    if [[ -n "$line" ]]; then
        if (( first == 1 )); then
            echo -e "  ${DE_CLR_STEP}${prefix}${DE_CLR_NC} ${DE_CLR_CMD}${line}${DE_CLR_NC}"
        else
            echo -e "${DE_CLR_CMD}${indent}${line}${DE_CLR_NC}"
        fi
    fi
}

# Print file with size
_de_print_file() {
    local file="$1"
    local base_dir="$2"
    local full_path="$base_dir/$file"

    if [[ -f "$full_path" ]]; then
        local size=$(stat -f%z "$full_path" 2>/dev/null || stat -c%s "$full_path" 2>/dev/null || echo "0")
        local size_str=$(_de_format_size "$size")
        printf "  ${DE_CLR_FILE}%-30s${DE_CLR_NC} ${DE_CLR_DIM}%6s${DE_CLR_NC}\n" "$file" "$size_str"
    else
        printf "  ${DE_CLR_WARN}%-30s${DE_CLR_NC} ${DE_CLR_DIM}%6s${DE_CLR_NC}\n" "$file" "(new)"
    fi
}

# =============================================================================
# STATE
# =============================================================================

# Parsed TOML data stored in associative arrays
declare -gA DE_TARGET=()       # [target] section
declare -gA DE_ENV=()          # [env.*] sections (flattened)
declare -gA DE_FILES=()        # [files] section
declare -gA DE_BUILD=()        # [build.*] sections
declare -gA DE_PUSH=()         # [push] section
declare -gA DE_PIPELINE=()     # [pipeline] section
declare -gA DE_ALIAS=()        # [alias] section
declare -gA DE_HISTORY=()      # [history] section
declare -gA DE_REMOTE=()       # [remote] section - commands to run on remote
declare -gA DE_POST=()         # [post] section - post-deploy commands

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
    DE_PUSH=()
    DE_PIPELINE=()
    DE_ALIAS=()
    DE_HISTORY=()
    DE_REMOTE=()
    DE_POST=()
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
                push)     DE_PUSH["$key"]="$val" ;;
                pipeline) DE_PIPELINE["$key"]="$val" ;;
                alias)    DE_ALIAS["$key"]="$val" ;;
                history)  DE_HISTORY["$key"]="$val" ;;
                remote)   DE_REMOTE["$key"]="$val" ;;
                post)     DE_POST["$key"]="$val" ;;
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

    # Resolve values with inheritance
    local ssh="${DE_ENV["$env.ssh"]}"
    local user="${DE_ENV["$env.user"]}"
    local domain="${DE_ENV["$env.domain"]}"

    local inherit="${DE_ENV["$env.inherit"]}"
    if [[ -n "$inherit" ]]; then
        [[ -z "$ssh" ]] && ssh="${DE_ENV["$inherit.ssh"]}"
        [[ -z "$user" ]] && user="${DE_ENV["$inherit.user"]}"
        [[ -z "$domain" ]] && domain="${DE_ENV["$inherit.domain"]}"
    fi

    # Build vars array from DE_* state
    local -A _tmpl_vars=(
        [ssh]="$ssh"
        [user]="$user"
        [domain]="$domain"
        [env]="$env"
        [name]="${DE_TARGET[name]}"
        [source]="${DE_TARGET[source]}"
        [cwd]="${DE_TARGET[cwd]}"
        [local]="$DE_TOML_DIR"
        [files]="$files"
        [target_dir]="${DE_TARGET[target_dir]}"
        [remote_build]="${DE_TARGET[remote_build]}"
        [branch]="${DE_ENV["$env.branch"]:-${DE_ENV["${inherit:-}.branch"]:-main}}"
    )

    _deploy_template_core "$str" _tmpl_vars
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
        echo -e "  ${DE_CLR_DIM}[skip]${DE_CLR_NC} build:$name ${DE_CLR_DIM}(not defined)${DE_CLR_NC}" >&2
        return 0
    fi

    local pre="${DE_BUILD[pre]}"
    if [[ -n "$pre" && -z "$_DE_PRE_RAN" ]]; then
        pre=$(_de_template "$pre" "$env")
        _de_print_cmd "[pre]" "$pre"
        if [[ "$dry_run" -eq 0 ]]; then
            pushd "$DE_TOML_DIR" >/dev/null || return 1
            eval "$pre" || { popd >/dev/null; return 1; }
            popd >/dev/null
        fi
        _DE_PRE_RAN=1
    fi

    cmd=$(_de_template "$cmd" "$env")
    _de_print_cmd "[build:$name]" "$cmd"

    if [[ "$dry_run" -eq 0 ]]; then
        pushd "$DE_TOML_DIR" >/dev/null || return 1
        eval "$cmd" || { popd >/dev/null; return 1; }
        popd >/dev/null
    fi
}

_de_exec_push() {
    local env="$1"
    local files="${2:-}"
    local dry_run="${3:-0}"

    local method="${DE_PUSH[method]:-rsync}"
    local options="${DE_PUSH[options]:--avz}"
    local chown="${DE_PUSH[chown]}"
    local chmod="${DE_PUSH[chmod]}"
    local delete="${DE_PUSH[delete]}"

    local ssh=$(_de_template "{{ssh}}" "$env")
    local cwd=$(_de_template "{{cwd}}" "$env")
    local source="${DE_TARGET[source]}"

    echo -e "  ${DE_CLR_STEP}[push]${DE_CLR_NC} ${DE_CLR_DIM}${ssh}:${cwd}/${DE_CLR_NC}"

    local cmd="rsync $options"
    [[ "$delete" == "true" ]] && cmd="$cmd --delete"
    [[ -n "$chown" ]] && cmd="$cmd --chown=$chown"

    local total_size=0
    local file_count=0

    if [[ -n "$files" && "$files" != "*.html" && "$files" != "*" ]]; then
        # Specific files - show each with size
        for f in $files; do
            local full_path="$DE_TOML_DIR/${source}$f"
            if [[ -f "$full_path" ]]; then
                local size=$(stat -f%z "$full_path" 2>/dev/null || stat -c%s "$full_path" 2>/dev/null || echo "0")
                local size_str=$(_de_format_size "$size")
                printf "    ${DE_CLR_FILE}%-28s${DE_CLR_NC} ${DE_CLR_DIM}%6s${DE_CLR_NC}\n" "$f" "$size_str"
                total_size=$((total_size + size))
                file_count=$((file_count + 1))
            else
                printf "    ${DE_CLR_WARN}%-28s${DE_CLR_NC} ${DE_CLR_DIM}%6s${DE_CLR_NC}\n" "$f" "(new)"
                file_count=$((file_count + 1))
            fi
            cmd="$cmd ${source}$f"
        done
        cmd="$cmd $ssh:$cwd/"
    else
        # All files from source
        if [[ -d "$DE_TOML_DIR/$source" ]]; then
            for full_path in "$DE_TOML_DIR/$source"*; do
                [[ -f "$full_path" ]] || continue
                local f=$(basename "$full_path")
                local size=$(stat -f%z "$full_path" 2>/dev/null || stat -c%s "$full_path" 2>/dev/null || echo "0")
                local size_str=$(_de_format_size "$size")
                printf "    ${DE_CLR_FILE}%-28s${DE_CLR_NC} ${DE_CLR_DIM}%6s${DE_CLR_NC}\n" "$f" "$size_str"
                total_size=$((total_size + size))
                file_count=$((file_count + 1))
            done
        fi
        cmd="$cmd ${source} $ssh:$cwd/"
    fi

    # Summary
    local total_str=$(_de_format_size "$total_size")
    echo -e "    ${DE_CLR_DIM}─────────────────────────────────────${DE_CLR_NC}"
    printf "    ${DE_CLR_DIM}%-28s %6s${DE_CLR_NC}\n" "$file_count files" "$total_str"

    if [[ "$dry_run" -eq 0 ]]; then
        (cd "$DE_TOML_DIR" && eval "$cmd") || return 1

        if [[ -n "$chmod" ]]; then
            echo -e "  ${DE_CLR_STEP}[chmod]${DE_CLR_NC} ${DE_CLR_DIM}$chmod${DE_CLR_NC}"
            ssh "$ssh" "chmod -R $chmod $cwd" || return 1
        fi
    fi
}

# Execute remote command from [remote] section
_de_exec_remote() {
    local name="$1"
    local env="$2"
    local dry_run="${3:-0}"

    local cmd="${DE_REMOTE[$name]}"
    if [[ -z "$cmd" ]]; then
        echo -e "  ${DE_CLR_WARN}[error]${DE_CLR_NC} No remote command: $name" >&2
        return 1
    fi

    # Template expansion
    cmd=$(_de_template "$cmd" "$env")

    local ssh=$(_de_template "{{ssh}}" "$env")

    echo -e "  ${DE_CLR_STEP}[remote:$name]${DE_CLR_NC}"
    _de_print_cmd "" "$cmd"

    if [[ "$dry_run" -eq 0 ]]; then
        ssh "$ssh" "$cmd" || return 1
    fi
}

# Execute post-deploy command from [post] section (runs on remote)
_de_exec_post() {
    local name="$1"
    local env="$2"
    local dry_run="${3:-0}"

    local cmd="${DE_POST[$name]}"
    if [[ -z "$cmd" ]]; then
        echo -e "  ${DE_CLR_WARN}[error]${DE_CLR_NC} No post command: $name" >&2
        return 1
    fi

    # Template expansion
    cmd=$(_de_template "$cmd" "$env")

    local ssh=$(_de_template "{{ssh}}" "$env")

    echo -e "  ${DE_CLR_STEP}[post:$name]${DE_CLR_NC}"
    _de_print_cmd "" "$cmd"

    if [[ "$dry_run" -eq 0 ]]; then
        ssh "$ssh" "$cmd" || return 1
    fi
}

de_run() {
    local pipeline="${1:-default}"
    local env="$2"
    local dry_run="${3:-0}"
    local items_override="${4:-}"  # Optional: space-separated file keys

    local resolved="${DE_ALIAS[$pipeline]}"
    [[ -n "$resolved" ]] && pipeline="$resolved"

    local steps="${DE_PIPELINE[$pipeline]}"
    if [[ -z "$steps" ]]; then
        echo "Pipeline not found: $pipeline" >&2
        echo "Available: $(de_pipelines)" >&2
        return 1
    fi

    # Store items override for build/sync steps (declare global)
    declare -g DE_ITEMS_OVERRIDE="$items_override"

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

    _de_init_colors

    echo -e "${DE_CLR_HEAD}[${DE_TARGET[name]}:$pipeline:$env]${DE_CLR_NC}"
    echo -e "${DE_CLR_DIM}────────────────────────────────────────${DE_CLR_NC}"
    [[ -n "$DE_ITEMS_OVERRIDE" ]] && echo -e "${DE_CLR_DIM}Files${DE_CLR_NC}  $DE_ITEMS_OVERRIDE"
    [[ "$dry_run" -eq 1 ]] && echo -e "${DE_CLR_WARN}[DRY RUN]${DE_CLR_NC}"
    echo -e "${DE_CLR_DIM}────────────────────────────────────────${DE_CLR_NC}"

    _DE_PRE_RAN=""
    local start_time=$SECONDS

    for step in $steps; do
        case "$step" in
            build:*)
                local build_name="${step#build:}"
                # If items specified, filter build steps
                if [[ -n "$DE_ITEMS_OVERRIDE" ]]; then
                    local should_build=0
                    # Skip build:all when items are specified (we'll build individual items)
                    if [[ "$build_name" == "all" ]]; then
                        echo -e "  ${DE_CLR_DIM}[skip]${DE_CLR_NC} build:all ${DE_CLR_DIM}(items specified)${DE_CLR_NC}"
                        # Instead, build each specified item
                        for item_key in $DE_ITEMS_OVERRIDE; do
                            _de_exec_build "$item_key" "$env" "$dry_run" || return 1
                        done
                        continue
                    fi
                    # Always allow build:index
                    [[ "$build_name" == "index" ]] && should_build=1
                    # Check if this build matches any specified item
                    for item_key in $DE_ITEMS_OVERRIDE; do
                        [[ "$build_name" == "$item_key" ]] && { should_build=1; break; }
                    done
                    if [[ $should_build -eq 0 ]]; then
                        echo -e "  ${DE_CLR_DIM}[skip]${DE_CLR_NC} build:$build_name ${DE_CLR_DIM}(not in items)${DE_CLR_NC}"
                        continue
                    fi
                fi
                _de_exec_build "$build_name" "$env" "$dry_run" || return 1
                ;;
            push)
                local files=""
                if [[ -n "$DE_ITEMS_OVERRIDE" ]]; then
                    # Resolve each item key to its file value
                    for item_key in $DE_ITEMS_OVERRIDE; do
                        local item_file=$(_de_resolve_files "$item_key")
                        [[ -n "$item_file" ]] && files="$files $item_file"
                    done
                    files="${files# }"
                else
                    files=$(_de_resolve_files "${pipeline}")
                    [[ -z "$files" ]] && files=$(_de_resolve_files "all")
                fi
                _de_exec_push "$env" "$files" "$dry_run" || return 1
                ;;
            remote:*)
                local remote_name="${step#remote:}"
                _de_exec_remote "$remote_name" "$env" "$dry_run" || return 1
                ;;
            post:*)
                local post_name="${step#post:}"
                _de_exec_post "$post_name" "$env" "$dry_run" || return 1
                ;;
            *)
                echo -e "  ${DE_CLR_WARN}[unknown]${DE_CLR_NC} $step" >&2
                ;;
        esac
    done

    local duration=$((SECONDS - start_time))
    echo -e "${DE_CLR_DIM}────────────────────────────────────────${DE_CLR_NC}"
    echo -e "${DE_CLR_OK}Done${DE_CLR_NC} ${DE_CLR_DIM}(${duration}s)${DE_CLR_NC}"

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
export -f _de_exec_build _de_exec_push _de_exec_remote _de_exec_post
export -f _de_init_colors _de_format_size _de_print_cmd _de_print_file
