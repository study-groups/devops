#!/usr/bin/env bash
# deploy_complete.sh - Tab completion for deploy command
#
# Follows org_complete.sh pattern for consistency
#
# Provides completion for:
#   - deploy subcommands
#   - target names (from org targets/)
#   - environment names (from org)

# =============================================================================
# COMPLETION DATA
# =============================================================================

# All deploy subcommands (no short aliases - use 'deploy help aliases')
_DEPLOY_COMMANDS="org target env info clear set push show list history doctor help items run"

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

# Get active org - uses _deploy_active_org if available, else inline fallback
_deploy_complete_get_org() {
    # Prefer the canonical function
    if type _deploy_active_org &>/dev/null; then
        _deploy_active_org 2>/dev/null
        return
    fi
    # Fallback: check DEPLOY_CTX_ORG, then org_active
    if [[ -n "$DEPLOY_CTX_ORG" ]]; then
        echo "$DEPLOY_CTX_ORG"
    elif type org_active &>/dev/null; then
        org_active 2>/dev/null
    fi
}

# List available orgs
_deploy_complete_orgs() {
    [[ -d "$TETRA_DIR/orgs" ]] || return
    ls "$TETRA_DIR/orgs" 2>/dev/null
}

# List target names for current deploy context org
_deploy_complete_targets() {
    local org=$(_deploy_complete_get_org)
    [[ -z "$org" || "$org" == "none" ]] && return

    local targets_dir="$TETRA_DIR/orgs/$org/targets"
    [[ -d "$targets_dir" ]] || return

    # .toml files (without extension)
    for f in "$targets_dir"/*.toml; do
        [[ -f "$f" ]] && basename "$f" .toml
    done

    # Directories with tetra-deploy.toml
    for d in "$targets_dir"/*/; do
        [[ -d "$d" && -f "$d/tetra-deploy.toml" ]] && basename "$d"
    done
}

# List environment names from org
_deploy_complete_envs() {
    if type org_env_names &>/dev/null; then
        org_env_names 2>/dev/null
    else
        # Fallback common env names
        echo "dev"
        echo "staging"
        echo "prod"
    fi
}

# List pipelines from [pipeline] section in target's TOML (no aliases)
_deploy_complete_pipelines() {
    local target="$1"
    [[ -z "$target" ]] && return

    local org=$(_deploy_complete_get_org)
    [[ -z "$org" || "$org" == "none" ]] && return

    local toml=""
    local targets_dir="$TETRA_DIR/orgs/$org/targets"

    # Find the TOML file
    if [[ -f "$targets_dir/$target/tetra-deploy.toml" ]]; then
        toml="$targets_dir/$target/tetra-deploy.toml"
    elif [[ -f "$targets_dir/${target}.toml" ]]; then
        toml="$targets_dir/${target}.toml"
    fi

    [[ -z "$toml" || ! -f "$toml" ]] && return

    # Extract pipeline names from [pipeline] section only
    awk '/^\[pipeline\]/{found=1; next} /^\[/{found=0} found && /^[a-zA-Z_][a-zA-Z0-9_-]*[ ]*=/{print $1}' "$toml"
}

# Complete target:pipeline format (also handles target:{items} syntax)
_deploy_complete_target_pipeline() {
    local cur="$1"

    # Check if cur contains ':'
    if [[ "$cur" == *:* ]]; then
        local target="${cur%%:*}"
        local partial="${cur#*:}"

        # Handle brace syntax: target:{item1,item2...
        if [[ "$partial" == "{"* ]]; then
            local inside="${partial#\{}"
            inside="${inside%\}}"
            # Get last item being typed (after last comma)
            local last_item="${inside##*,}"
            local prefix="${inside%$last_item}"
            [[ -n "$prefix" ]] && prefix="{$prefix" || prefix="{"

            local items=$(_deploy_complete_items "$target" 2>/dev/null)
            for item in $items; do
                [[ "$item" == "$last_item"* ]] && echo "$target:$prefix$item"
            done
            return
        fi

        # Regular pipeline completion
        local pipelines=$(_deploy_complete_pipelines "$target" 2>/dev/null)
        for p in $pipelines; do
            [[ "$p" == "$partial"* ]] && echo "$target:$p"
        done

        # Also offer brace syntax start
        [[ -z "$partial" || "{" == "$partial"* ]] && echo "$target:{"
        [[ -z "$partial" || "*" == "$partial"* ]] && echo "$target:*"
    fi
}

# List environments for a specific target (from its TOML)
_deploy_complete_target_envs() {
    local target="$1"
    [[ -z "$target" ]] && return

    local org=$(_deploy_complete_get_org)
    [[ -z "$org" || "$org" == "none" ]] && return

    local toml=""
    local targets_dir="$TETRA_DIR/orgs/$org/targets"

    # Check directory with tetra-deploy.toml first
    if [[ -f "$targets_dir/$target/tetra-deploy.toml" ]]; then
        toml="$targets_dir/$target/tetra-deploy.toml"
    elif [[ -f "$targets_dir/${target}.toml" ]]; then
        toml="$targets_dir/${target}.toml"
    fi

    [[ -z "$toml" || ! -f "$toml" ]] && return

    # Extract env names from [env.*] sections
    grep -oE '^\[env\.[^]]+\]' "$toml" 2>/dev/null | \
        sed -E 's/^\[env\.([^]]+)\]$/\1/' | \
        grep -v '^all$' | sort -u
}

# List both targets and envs (for first arg after push/show)
_deploy_complete_targets_or_envs() {
    _deploy_complete_targets
    _deploy_complete_envs
}

# List item names from current target's [files] section
_deploy_complete_items() {
    local target="${1:-$DEPLOY_CTX_TARGET}"
    [[ -z "$target" ]] && return

    local toml=""
    if [[ "$target" == "." ]]; then
        toml="./tetra-deploy.toml"
    else
        local org=$(_deploy_complete_get_org)
        [[ -z "$org" || "$org" == "none" ]] && return

        local targets_dir="$TETRA_DIR/orgs/$org/targets"
        if [[ -f "$targets_dir/$target/tetra-deploy.toml" ]]; then
            toml="$targets_dir/$target/tetra-deploy.toml"
        elif [[ -f "$targets_dir/${target}.toml" ]]; then
            toml="$targets_dir/${target}.toml"
        fi
    fi

    [[ -z "$toml" || ! -f "$toml" ]] && return

    # Extract keys from [files] section
    awk '/^\[files\]/{found=1; next} /^\[/{found=0} found && /^[a-zA-Z_][a-zA-Z0-9_-]*[ ]*=/{print $1}' "$toml"
}

# Complete items with - or = prefix
_deploy_complete_prefixed_items() {
    local prefix="$1"  # "-" or "="
    local cur="$2"
    local items=$(_deploy_complete_items 2>/dev/null)

    for item in $items; do
        echo "${prefix}${item}"
    done
}

# List operations from [pipeline] section (same as pipelines)
_deploy_complete_operations() {
    local target="${1:-$DEPLOY_CTX_TARGET}"
    [[ -z "$target" ]] && return
    _deploy_complete_pipelines "$target"
}

# =============================================================================
# MAIN COMPLETION FUNCTION
# =============================================================================

# Fix colon completions - call after setting COMPREPLY
_deploy_complete_colon_fix() {
    local cur="$1"
    [[ "$cur" != *:* || ${#COMPREPLY[@]} -eq 0 ]] && return
    __ltrim_colon_completions "$cur" 2>/dev/null || {
        local colon_prefix="${cur%"${cur##*:}"}"
        local i
        for i in "${!COMPREPLY[@]}"; do
            COMPREPLY[$i]="${COMPREPLY[$i]#"$colon_prefix"}"
        done
    }
}

_deploy_complete() {
    local cur prev cmd
    _get_comp_words_by_ref -n : cur prev 2>/dev/null || {
        cur="${COMP_WORDS[COMP_CWORD]}"
        prev="${COMP_WORDS[COMP_CWORD-1]}"
    }
    cmd="${COMP_WORDS[1]:-}"

    # Handle colon-split edge case: "deploy target docs:" splits into words
    # Reconstruct target:pipeline pattern when prev ends with target name and cur is after colon
    local full_cur="$cur"
    if [[ "$prev" == ":" && $COMP_CWORD -ge 3 ]]; then
        # prev is ":", look back one more for the target name
        local target_name="${COMP_WORDS[COMP_CWORD-2]}"
        full_cur="${target_name}:${cur}"
    elif [[ "$prev" =~ ^[a-zA-Z_][a-zA-Z0-9_-]*$ && "$cur" == ":"* ]]; then
        full_cur="${prev}${cur}"
    fi

    COMPREPLY=()

    # Special case: "deploy target docs:" - handle colon-split pipeline completion
    if [[ "$cmd" == "target" || "$cmd" == "t" ]] && [[ "$full_cur" == *:* ]]; then
        local completions=$(_deploy_complete_target_pipeline "$full_cur" 2>/dev/null)
        COMPREPLY=($(compgen -W "$completions" -- "$full_cur"))
        _deploy_complete_colon_fix "$full_cur"
        return
    fi

    # First argument - complete subcommands or targets (with :pipeline support)
    if [[ $COMP_CWORD -eq 1 ]]; then
        # Check for target:pipeline format
        if [[ "$cur" == *:* ]]; then
            local completions=$(_deploy_complete_target_pipeline "$cur" 2>/dev/null)
            COMPREPLY=($(compgen -W "$completions" -- "$cur"))
            _deploy_complete_colon_fix "$cur"
            return
        fi

        # Commands + targets
        local words="$_DEPLOY_COMMANDS $(_deploy_complete_targets 2>/dev/null)"
        COMPREPLY=($(compgen -W "$words" -- "$cur"))

        # If completing a target, also offer target: to show pipelines available
        if [[ -n "$cur" ]]; then
            local targets=$(_deploy_complete_targets 2>/dev/null)
            for t in $targets; do
                if [[ "$t" == "$cur" ]]; then
                    # Exact match - also offer target:
                    COMPREPLY+=("$t:")
                fi
            done
        fi
        return
    fi

    # Handle flags anywhere
    if [[ "$cur" == -* ]]; then
        COMPREPLY=($(compgen -W "--dry-run -n" -- "$cur"))
        return
    fi

    # Second argument
    if [[ $COMP_CWORD -eq 2 ]]; then
        # Check if first arg was target:pipeline format
        if [[ "$cmd" == *:* ]]; then
            local target="${cmd%%:*}"
            local envs=$(_deploy_complete_target_envs "$target" 2>/dev/null)
            [[ -z "$envs" ]] && envs=$(_deploy_complete_envs 2>/dev/null)
            # Add --edit and item filters
            local item_opts="--edit $(_deploy_complete_prefixed_items "-" "" 2>/dev/null) $(_deploy_complete_prefixed_items "=" "" 2>/dev/null)"
            COMPREPLY=($(compgen -W "$envs $item_opts" -- "$cur"))
            return
        fi

        case "$cmd" in
            set)
                # After set: complete org names
                COMPREPLY=($(compgen -W "$(_deploy_complete_orgs 2>/dev/null)" -- "$cur"))
                return
                ;;
            org|o)
                # After org: complete org names
                COMPREPLY=($(compgen -W "$(_deploy_complete_orgs 2>/dev/null)" -- "$cur"))
                return
                ;;
            target|t)
                # After target: complete target names or "."
                # Also handle target:subtarget format
                if [[ "$cur" == *:* ]]; then
                    local completions=$(_deploy_complete_target_pipeline "$cur" 2>/dev/null)
                    COMPREPLY=($(compgen -W "$completions" -- "$cur"))
                    _deploy_complete_colon_fix "$cur"
                    return
                fi
                local words=". $(_deploy_complete_targets 2>/dev/null)"
                COMPREPLY=($(compgen -W "$words" -- "$cur"))
                # If exact match on target, also offer target: for subtargets
                if [[ -n "$cur" ]]; then
                    local targets=$(_deploy_complete_targets 2>/dev/null)
                    for t in $targets; do
                        if [[ "$t" == "$cur" ]]; then
                            COMPREPLY+=("$t:")
                        fi
                    done
                fi
                return
                ;;
            env|e)
                # After env: complete env names
                COMPREPLY=($(compgen -W "$(_deploy_complete_envs 2>/dev/null)" -- "$cur"))
                return
                ;;
            push|p|show|s)
                # After push/show: complete targets only
                COMPREPLY=($(compgen -W "$(_deploy_complete_targets 2>/dev/null)" -- "$cur"))
                return
                ;;
            -n|--dry-run)
                # After flag: complete targets only
                COMPREPLY=($(compgen -W "$(_deploy_complete_targets 2>/dev/null)" -- "$cur"))
                return
                ;;
            list|ls|info|i|clear|c)
                # These take no args
                return
                ;;
            doctor|doc)
                # doctor subcommands
                COMPREPLY=($(compgen -W "reload complete r comp" -- "$cur"))
                return
                ;;
            history|hist)
                # history takes -v or number
                COMPREPLY=($(compgen -W "-v" -- "$cur"))
                return
                ;;
            help|h)
                # Help takes topic names
                COMPREPLY=($(compgen -W "taxonomy dry-run items context direct history targets vars modes aliases" -- "$cur"))
                return
                ;;
            items)
                # items subcommands: reset, or -item/=item prefixed names
                local words="reset"
                if [[ "$cur" == -* ]]; then
                    words=$(_deploy_complete_prefixed_items "-" "$cur" 2>/dev/null)
                elif [[ "$cur" == =* ]]; then
                    words=$(_deploy_complete_prefixed_items "=" "$cur" 2>/dev/null)
                else
                    # Offer both - and = prefixed items
                    words="reset $(_deploy_complete_prefixed_items "-" "$cur" 2>/dev/null) $(_deploy_complete_prefixed_items "=" "$cur" 2>/dev/null)"
                fi
                COMPREPLY=($(compgen -W "$words" -- "$cur"))
                return
                ;;
            run)
                # run takes operation names
                COMPREPLY=($(compgen -W "$(_deploy_complete_operations 2>/dev/null) -n --dry-run" -- "$cur"))
                return
                ;;
            *)
                # Check if first arg is a valid target
                local targets=$(_deploy_complete_targets 2>/dev/null)
                if [[ -n "$targets" ]] && echo "$targets" | grep -qxF "$cmd"; then
                    # First arg is a target, complete with envs
                    COMPREPLY=($(compgen -W "$(_deploy_complete_envs 2>/dev/null)" -- "$cur"))
                fi
                # Otherwise invalid first arg - no completion
                return
                ;;
        esac
    fi

    # Third argument
    if [[ $COMP_CWORD -eq 3 ]]; then
        local target="${COMP_WORDS[2]}"
        case "$cmd" in
            set)
                # deploy set <org> <target>: complete with targets
                COMPREPLY=($(compgen -W "$(_deploy_complete_targets 2>/dev/null)" -- "$cur"))
                return
                ;;
            doctor|doc)
                # deploy doctor complete <target>
                if [[ "$target" == "complete" || "$target" == "comp" ]]; then
                    COMPREPLY=($(compgen -W "$(_deploy_complete_targets 2>/dev/null)" -- "$cur"))
                fi
                return
                ;;
            target|t)
                # If target already has :subtarget, complete with envs
                if [[ "$target" == *:* ]]; then
                    local base_target="${target%%:*}"
                    local target_envs=$(_deploy_complete_target_envs "$base_target" 2>/dev/null)
                    [[ -z "$target_envs" ]] && target_envs=$(_deploy_complete_envs 2>/dev/null)
                    COMPREPLY=($(compgen -W "$target_envs" -- "$cur"))
                    return
                fi
                # After deploy target <name>: complete with pipelines
                local pipelines=$(_deploy_complete_pipelines "$target" 2>/dev/null)
                if [[ -n "$pipelines" ]]; then
                    COMPREPLY=($(compgen -W "$pipelines" -- "$cur"))
                fi
                return
                ;;
            push|p|show|s)
                # After target: complete with target's envs or fallback
                local target_envs=$(_deploy_complete_target_envs "$target" 2>/dev/null)
                if [[ -n "$target_envs" ]]; then
                    COMPREPLY=($(compgen -W "$target_envs" -- "$cur"))
                else
                    COMPREPLY=($(compgen -W "$(_deploy_complete_envs 2>/dev/null)" -- "$cur"))
                fi
                return
                ;;
            -n|--dry-run)
                # deploy -n <target> <env>
                COMPREPLY=($(compgen -W "$(_deploy_complete_envs 2>/dev/null)" -- "$cur"))
                return
                ;;
        esac
    fi

    # Fourth argument
    if [[ $COMP_CWORD -eq 4 ]]; then
        case "$cmd" in
            set)
                # deploy set <org> <target> <env>: complete with envs
                COMPREPLY=($(compgen -W "$(_deploy_complete_envs 2>/dev/null)" -- "$cur"))
                return
                ;;
        esac
        case "${COMP_WORDS[2]}" in
            -n|--dry-run)
                # deploy push -n <target> <env>
                COMPREPLY=($(compgen -W "$(_deploy_complete_envs 2>/dev/null)" -- "$cur"))
                ;;
        esac
    fi

    # Final colon fix (safety fallback for any missed paths)
    _deploy_complete_colon_fix "$cur"
}

# Register completion
complete -F _deploy_complete deploy

# =============================================================================
# EXPORTS
# =============================================================================

export -f _deploy_complete _deploy_complete_get_org _deploy_complete_colon_fix
export -f _deploy_complete_orgs _deploy_complete_targets _deploy_complete_envs
export -f _deploy_complete_pipelines _deploy_complete_target_pipeline
export -f _deploy_complete_target_envs _deploy_complete_targets_or_envs
export -f _deploy_complete_items _deploy_complete_prefixed_items _deploy_complete_operations
