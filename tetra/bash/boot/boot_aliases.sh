#!/usr/bin/env bash

# Boot Aliases - Common aliases and shortcuts

# Python and Node activation aliases
alias tpa='tetra_python_activate'
alias tna='tetra_nvm_activate'

# Common shortcuts
alias tt='tetra_status'
alias tl='tetra_list_modules'
alias tm='tmod'

# Lazy-load function pattern for modules
# Defines function immediately but loads module on first use
# This keeps startup fast while providing instant command availability

# Tetra Orchestrator launcher
# NOTE: Removed auto-source to prevent circular dependency during boot
# The tetra orchestrator can be manually sourced when needed:
#   source "$TETRA_SRC/bash/tetra/tetra.sh"
