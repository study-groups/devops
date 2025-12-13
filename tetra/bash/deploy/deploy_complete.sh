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

# All deploy subcommands
_DEPLOY_COMMANDS="org target env info clear push show list history doctor help"

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

# List available orgs
_deploy_complete_orgs() {
    [[ -d "$TETRA_DIR/orgs" ]] || return
    ls "$TETRA_DIR/orgs" 2>/dev/null
}

# List target names for current deploy context org
_deploy_complete_targets() {
    # Use deploy context org, or fall back to global org
    local org="${DEPLOY_CTX_ORG:-}"
    if [[ -z "$org" ]] && type org_active &>/dev/null; then
        org=$(org_active 2>/dev/null)
    fi
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

# List pipelines from [pipeline] and [alias] sections in target's TOML
_deploy_complete_pipelines() {
    local target="$1"
    [[ -z "$target" ]] && return

    # Use deploy context org, or fall back to global org
    local org="${DEPLOY_CTX_ORG:-}"
    if [[ -z "$org" ]] && type org_active &>/dev/null; then
        org=$(org_active 2>/dev/null)
    fi
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

    # Extract pipeline names from [pipeline] section
    awk '/^\[pipeline\]/{found=1; next} /^\[/{found=0} found && /^[a-zA-Z_][a-zA-Z0-9_-]*[ ]*=/{print $1}' "$toml"

    # Extract alias names from [alias] section
    awk '/^\[alias\]/{found=1; next} /^\[/{found=0} found && /^[a-zA-Z_][a-zA-Z0-9_-]*[ ]*=/{print $1}' "$toml"
}

# Complete target:pipeline format
_deploy_complete_target_pipeline() {
    local cur="$1"

    # Check if cur contains ':'
    if [[ "$cur" == *:* ]]; then
        local target="${cur%%:*}"
        local partial="${cur#*:}"
        local pipelines=$(_deploy_complete_pipelines "$target" 2>/dev/null)
        for p in $pipelines; do
            [[ "$p" == "$partial"* ]] && echo "$target:$p"
        done
    fi
}

# List environments for a specific target (from its TOML)
_deploy_complete_target_envs() {
    local target="$1"
    [[ -z "$target" ]] && return

    # Use deploy context org, or fall back to global org
    local org="${DEPLOY_CTX_ORG:-}"
    if [[ -z "$org" ]] && type org_active &>/dev/null; then
        org=$(org_active 2>/dev/null)
    fi
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

# =============================================================================
# MAIN COMPLETION FUNCTION
# =============================================================================

_deploy_complete() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"
    local cmd="${COMP_WORDS[1]:-}"

    COMPREPLY=()

    # First argument - complete subcommands or targets (with :pipeline support)
    if [[ $COMP_CWORD -eq 1 ]]; then
        # Check for target:pipeline format
        if [[ "$cur" == *:* ]]; then
            local completions=$(_deploy_complete_target_pipeline "$cur" 2>/dev/null)
            COMPREPLY=($(compgen -W "$completions" -- "$cur"))
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
            COMPREPLY=($(compgen -W "$envs" -- "$cur"))
            return
        fi

        case "$cmd" in
            org|o)
                # After org: complete org names
                COMPREPLY=($(compgen -W "$(_deploy_complete_orgs 2>/dev/null)" -- "$cur"))
                return
                ;;
            target|t)
                # After target: complete target names or "."
                COMPREPLY=($(compgen -W ". $(_deploy_complete_targets 2>/dev/null)" -- "$cur"))
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
            list|ls|info|i|clear|c|doctor|doc)
                # These take no args
                return
                ;;
            history|hist)
                # history takes -v or number
                COMPREPLY=($(compgen -W "-v" -- "$cur"))
                return
                ;;
            help|h)
                # Help takes topic names
                COMPREPLY=($(compgen -W "context direct history targets vars modes" -- "$cur"))
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
            target|t)
                # After deploy target <name>: complete with sub-targets
                local subtargets=$(_deploy_complete_subtargets "$target" 2>/dev/null)
                if [[ -n "$subtargets" ]]; then
                    COMPREPLY=($(compgen -W "$subtargets" -- "$cur"))
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

    # Fourth argument (for deploy push -n target env)
    if [[ $COMP_CWORD -eq 4 ]]; then
        case "${COMP_WORDS[2]}" in
            -n|--dry-run)
                COMPREPLY=($(compgen -W "$(_deploy_complete_envs 2>/dev/null)" -- "$cur"))
                return
                ;;
        esac
    fi
}

# Register completion
complete -F _deploy_complete deploy

# =============================================================================
# EXPORTS
# =============================================================================

export -f _deploy_complete
export -f _deploy_complete_orgs _deploy_complete_targets _deploy_complete_envs
export -f _deploy_complete_subtargets _deploy_complete_target_envs _deploy_complete_targets_or_envs
