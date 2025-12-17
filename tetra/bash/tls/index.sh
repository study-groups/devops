#!/usr/bin/env bash

# TLS Module Index - Defines metadata and completions for TLS

# Register TLS module metadata (if registry available)
if declare -f tetra_register_module_meta >/dev/null 2>&1; then
    tetra_register_module_meta "tls" \
        "Time-ordered List - TDS-styled directory listing with mtime sorting" \
        "tls" \
        "tls:list|tree|config|help" \
        "core" "stable"
fi

# TLS-specific tab completion
_tls_completion() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"
    local cmd="${COMP_WORDS[1]}"

    case "$cmd" in
        config|c)
            if [[ "$COMP_CWORD" -eq 2 ]]; then
                COMPREPLY=($(compgen -W "show list get set save load path" -- "$cur"))
                return
            fi
            local subcmd="${COMP_WORDS[2]:-}"
            case "$subcmd" in
                set|get)
                    if [[ "$COMP_CWORD" -eq 3 ]]; then
                        COMPREPLY=($(compgen -W "limit date_format show_hidden theme columns" -- "$cur"))
                    fi
                    ;;
            esac
            ;;
        color)
            if [[ "$COMP_CWORD" -eq 2 ]]; then
                COMPREPLY=($(compgen -W "show edit init path get help" -- "$cur"))
                return
            fi
            local subcmd="${COMP_WORDS[2]:-}"
            case "$subcmd" in
                get)
                    if [[ "$COMP_CWORD" -eq 3 ]]; then
                        COMPREPLY=($(compgen -W "time.hot time.warm time.neutral time.cool file.directory file.executable file.symlink file.code file.config git.staged git.modified git.untracked git.clean ui.heading ui.separator" -- "$cur"))
                    fi
                    ;;
            esac
            ;;
        help|h)
            COMPREPLY=($(compgen -W "list tree config colors" -- "$cur"))
            ;;
        *)
            # Flags and paths
            if [[ "$cur" == -* ]]; then
                COMPREPLY=($(compgen -W "-t -l -a -g --tree --long --all --git -ta -tl -la -lg -al -gl" -- "$cur"))
            elif [[ "$cur" == */* || "$cur" == .* || "$cur" == ~* ]]; then
                # Path-like input: complete directories only
                COMPREPLY=($(compgen -d -- "$cur"))
                compopt -o filenames -o nospace
            else
                # Complete subcommands or directories
                COMPREPLY=($(compgen -W "config color help" -- "$cur"))
                # Add directory completion for paths
                local dirs=($(compgen -d -- "$cur"))
                COMPREPLY+=("${dirs[@]}")
            fi
            ;;
    esac
}

# Register TLS completion
complete -F _tls_completion tls
