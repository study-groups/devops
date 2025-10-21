#!/usr/bin/env bash

# Boot Aliases - Common aliases and shortcuts

# Python and Node activation aliases
alias tpa='tetra_python_activate'
alias tna='tetra_nvm_activate'

# Common shortcuts
alias tt='tetra_status'
alias tl='tetra_list_modules'
alias tm='tmod'

# Tetra Orchestrator launcher
# Source and use the new tetra orchestrator
if [[ -f "$TETRA_SRC/bash/tetra/tetra.sh" ]]; then
    source "$TETRA_SRC/bash/tetra/tetra.sh"
fi
