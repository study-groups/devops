#!/usr/bin/env bash

# Boot Aliases - Common aliases and shortcuts

# Python and Node activation aliases
alias tpa='tetra_python_activate'
alias tna='tetra_nvm_activate'

# Common shortcuts
alias tt='tetra_status'
alias tl='tetra_list_modules'
alias tm='tmod'

# Tetra REPL launcher
tetra() {
    # Direct call to tetra REPL script
    local tetra_repl_script="${TETRA_SRC:-$HOME/src/devops/tetra}/bash/tetra_repl.sh"
    if [[ -f "$tetra_repl_script" ]]; then
        bash "$tetra_repl_script" "$@"
    else
        echo "Tetra REPL script not found: $tetra_repl_script"
        echo "Set TETRA_SRC to point to your tetra source directory"
        return 1
    fi
}
