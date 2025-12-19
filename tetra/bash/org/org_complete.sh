#!/usr/bin/env bash
# org_complete.sh - Simple tab completion for org command
#
# Provides completion for:
#   - org subcommands
#   - org names (for switch)
#   - toml sections (for view/section)

# =============================================================================
# COMPLETION DATA
# =============================================================================

# All org subcommands (longest form only, no aliases)
_ORG_COMMANDS="status list switch create init build alias unalias view edit section sections get set validate path env import pdata help"

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

# List org names (for switch completion) - includes aliases
_org_complete_names() {
    local orgs_dir="$TETRA_DIR/orgs"
    [[ -d "$orgs_dir" ]] || return
    for dir in "$orgs_dir"/*/; do
        [[ -d "$dir" ]] && basename "$dir"
    done
}

# List canonical org names only (real directories, not symlinks)
_org_complete_canonical() {
    local orgs_dir="$TETRA_DIR/orgs"
    [[ -d "$orgs_dir" ]] || return
    for dir in "$orgs_dir"/*/; do
        local path="${dir%/}"
        [[ -d "$path" && ! -L "$path" ]] && basename "$path"
    done
}

# List alias names only (symlinks)
_org_complete_aliases() {
    local orgs_dir="$TETRA_DIR/orgs"
    [[ -d "$orgs_dir" ]] || return
    for link in "$orgs_dir"/*/; do
        local path="${link%/}"
        [[ -L "$path" ]] && basename "$path"
    done
}

# List section names from active tetra.toml
_org_complete_sections() {
    local toml=$(org_toml_path 2>/dev/null) || return
    _org_extract_sections "$toml" | sort -u
}

# List environment names (uses org_env_names from org_env.sh)
_org_complete_envs() {
    org_env_names 2>/dev/null
}

# List top-level sections (environments, org, etc)
_org_complete_sections_top() {
    local toml=$(org_toml_path 2>/dev/null) || return
    grep -oE '^\[[^].]+' "$toml" | tr -d '[' | sort -u
}

# List keys in a section (for get/set completion)
_org_complete_keys() {
    local section="$1"
    local toml=$(org_toml_path 2>/dev/null) || return

    # Extract keys from section
    awk -v sect="$section" '
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
            print sect "." key
        }
    ' "$toml"
}

# =============================================================================
# MAIN COMPLETION FUNCTION
# =============================================================================

_org_complete() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"
    local cmd="${COMP_WORDS[1]:-}"

    COMPREPLY=()

    # First argument - complete subcommands
    if [[ $COMP_CWORD -eq 1 ]]; then
        COMPREPLY=($(compgen -W "$_ORG_COMMANDS" -- "$cur"))
        return
    fi

    # Second argument - depends on command
    if [[ $COMP_CWORD -eq 2 ]]; then
        case "$cmd" in
            switch|init|build|sections)
                COMPREPLY=($(compgen -W "$(_org_complete_names)" -- "$cur"))
                return
                ;;

            # import: complete subcommands
            import)
                COMPREPLY=($(compgen -W "nh list help" -- "$cur"))
                return
                ;;

            # pdata: complete subcommands
            pdata)
                COMPREPLY=($(compgen -W "status init" -- "$cur"))
                return
                ;;

            # alias: second arg is short name (user types), no completion
            alias)
                return
                ;;

            # unalias: complete alias names
            unalias)
                COMPREPLY=($(compgen -W "$(_org_complete_aliases)" -- "$cur"))
                return
                ;;

            view)
                COMPREPLY=($(compgen -W "$(_org_complete_sections_top)" -- "$cur"))
                return
                ;;

            section)
                COMPREPLY=($(compgen -W "$(_org_complete_sections)" -- "$cur"))
                return
                ;;

            get|set)
                # If user typed partial section, complete it
                if [[ "$cur" == *.* ]]; then
                    # Has a dot - complete keys in that section
                    local section="${cur%.*}"
                    COMPREPLY=($(compgen -W "$(_org_complete_keys "$section")" -- "$cur"))
                else
                    # No dot yet - complete sections
                    local sections=$(_org_complete_sections)
                    # Add trailing dot to indicate more completion needed
                    COMPREPLY=($(compgen -W "$sections" -- "$cur"))
                    # Add dot suffix to indicate subsection needed
                    if [[ ${#COMPREPLY[@]} -eq 1 ]]; then
                        COMPREPLY=("${COMPREPLY[0]}.")
                        compopt -o nospace
                    fi
                fi
                return
                ;;

            # Environment command - complete env names
            env)
                COMPREPLY=($(compgen -W "$(_org_complete_envs)" -- "$cur"))
                return
                ;;
        esac
    fi

    # Third argument for set command (value) - no completion
    if [[ $COMP_CWORD -eq 3 && "$cmd" == "set" ]]; then
        return
    fi

    # Third argument for alias command (canonical org name)
    if [[ $COMP_CWORD -eq 3 && "$cmd" == "alias" ]]; then
        COMPREPLY=($(compgen -W "$(_org_complete_canonical)" -- "$cur"))
        return
    fi

    # Third argument for import nh (org name)
    if [[ $COMP_CWORD -eq 3 && "$cmd" == "import" ]]; then
        COMPREPLY=($(compgen -W "$(_org_complete_names)" -- "$cur"))
        return
    fi

    # Third argument for pdata init/status (org name)
    if [[ $COMP_CWORD -eq 3 && "$cmd" == "pdata" ]]; then
        COMPREPLY=($(compgen -W "$(_org_complete_names)" -- "$cur"))
        return
    fi

    # Fourth argument for import nh (optional json file path)
    if [[ $COMP_CWORD -eq 4 && "$cmd" == "import" ]]; then
        # File completion for json files
        COMPREPLY=($(compgen -f -X '!*.json' -- "$cur"))
        compopt -o filenames
        return
    fi
}

# Register completion
complete -F _org_complete org

# Completion functions are local - no exports needed
