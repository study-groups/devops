#!/usr/bin/env bash
# safe_exec.sh - Run commands with BASH_FUNC_* vars stripped
# Prevents bash 5.2+ exported functions from breaking /bin/sh subprocesses

tetra_exec() {
    # Collect BASH_FUNC_* variable names from environment
    local -a unset_args=()
    local var
    while IFS= read -r var; do
        [[ -n "$var" ]] && unset_args+=(-u "$var")
    done < <(env | grep -o '^BASH_FUNC_[^=]*' 2>/dev/null)

    if [[ ${#unset_args[@]} -gt 0 ]]; then
        env "${unset_args[@]}" "$@"
    else
        "$@"
    fi
}

export -f tetra_exec
