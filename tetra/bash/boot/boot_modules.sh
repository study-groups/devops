#!/usr/bin/env bash

# Boot Modules - Module registration and lazy loading setup

# Use TETRA_BASH for bash directory path
: "${TETRA_BASH:=$TETRA_SRC/bash}"

# Register all core modules for lazy loading
tetra_register_module "utils" "$TETRA_BASH/utils"
tetra_register_module "tsm" "$TETRA_BASH/tsm"
tetra_register_module "tkm" "$TETRA_BASH/tkm"
tetra_register_module "prompt" "$TETRA_BASH/prompt"
tetra_register_module "python" "$TETRA_BASH/python"
tetra_register_module "nvm" "$TETRA_BASH/nvm"
tetra_register_module "node" "$TETRA_BASH/node"
tetra_register_module "ssh" "$TETRA_BASH/ssh"
tetra_register_module "sync" "$TETRA_BASH/sync"
tetra_register_module "enc" "$TETRA_BASH/enc"
tetra_register_module "deploy" "$TETRA_BASH/deploy"
tetra_register_module "tview" "$TETRA_BASH/tview"
tetra_register_module "org" "$TETRA_BASH/org"
tetra_register_module "git" "$TETRA_BASH/git"
tetra_register_module "nginx" "$TETRA_BASH/nginx"
tetra_register_module "pm" "$TETRA_BASH/pm"
tetra_register_module "service" "$TETRA_BASH/service"
tetra_register_module "sys" "$TETRA_BASH/sys"
tetra_register_module "self" "$TETRA_BASH/self"
tetra_register_module "tmux" "$TETRA_BASH/tmux"
tetra_register_module "user" "$TETRA_BASH/user"
tetra_register_module "hotrod" "$TETRA_BASH/hotrod"
tetra_register_module "ml" "$TETRA_BASH/ml"
tetra_register_module "paste" "$TETRA_BASH/paste"
tetra_register_module "pb" "$TETRA_BASH/pb"
tetra_register_module "pbvm" "$TETRA_BASH/pbvm"
tetra_register_module "pico" "$TETRA_BASH/pico"
tetra_register_module "svg" "$TETRA_BASH/svg"
tetra_register_module "tro" "$TETRA_BASH/tro"
tetra_register_module "anthropic" "$TETRA_BASH/anthropic"
tetra_register_module "reporting" "$TETRA_BASH/reporting"
tetra_register_module "claude" "$TETRA_BASH/claude"
tetra_register_module "spaces" "$TETRA_BASH/spaces"
tetra_register_module "gamepak" "$TETRA_BASH/gamepak"
tetra_register_module "vox" "$TETRA_BASH/vox"

# Register internal modules for RAG and Melvin (qa registered in boot_core.sh)
tetra_register_module "rag" "$TETRA_BASH/rag"
tetra_register_module "tdocs" "$TETRA_BASH/tdocs"
tetra_register_module "melvin" "$TETRA_BASH/melvin"
tetra_register_module "midi" "$TETRA_BASH/midi"
tetra_register_module "tperf" "$TETRA_BASH/tperf"
tetra_register_module "tds" "$TETRA_BASH/tds"
tetra_register_module "chroma" "$TETRA_BASH/chroma"
tetra_register_module "magicfind" "$TETRA_BASH/magicfind"

# Register external modules (lazy loaded)
tetra_register_module "logtime" "$HOME/src/bash/logtime"

# Create lazy loading stubs for all module functions
tetra_create_lazy_function "rag_repl" "rag"
tetra_create_lazy_function "rag_load_tools" "rag"
tetra_create_lazy_function "tetra_rag_search" "rag"
tetra_create_lazy_function "tetra_rag_chunks" "rag"
tetra_create_lazy_function "tetra_rag_context" "rag"
tetra_create_lazy_function "tetra_rag_cite" "rag"
tetra_create_lazy_function "tetra_rag_export_jsonl" "rag"
tetra_create_lazy_function "tsm" "tsm"

# TSM tab completion (registered before lazy load so it works immediately)
_tsm_complete_services() {
    local cur="$1"
    local completions=()
    if [[ "$cur" == */* ]]; then
        local org="${cur%%/*}"
        local partial="${cur#*/}"
        local services_dir="$TETRA_DIR/orgs/$org/tsm/services-available"
        if [[ -d "$services_dir" ]]; then
            for svc in "$services_dir"/*.tsm; do
                [[ -f "$svc" ]] || continue
                local name=$(basename "$svc" .tsm)
                [[ "$name" == "$partial"* ]] && completions+=("$org/$name")
            done
        fi
    else
        for org_dir in "$TETRA_DIR/orgs"/*/tsm; do
            [[ -d "$org_dir" ]] || continue
            local org=$(basename "$(dirname "$org_dir")")
            [[ "$org" == "$cur"* ]] && completions+=("$org/")
        done
        for org_dir in "$TETRA_DIR/orgs"/*/tsm/services-available; do
            [[ -d "$org_dir" ]] || continue
            local org=$(basename "$(dirname "$(dirname "$org_dir")")")
            for svc in "$org_dir"/*.tsm; do
                [[ -f "$svc" ]] || continue
                local name=$(basename "$svc" .tsm)
                [[ "$name" == "$cur"* ]] && completions+=("$org/$name")
            done
        done
    fi
    echo "${completions[*]}"
}

_tsm_completion() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local cmd="${COMP_WORDS[1]}"
    compopt -o nospace 2>/dev/null
    case "$cmd" in
        start|enable|disable|show)
            local services=$(_tsm_complete_services "$cur")
            COMPREPLY=($(compgen -W "$services" -- "$cur"))
            [[ ${#COMPREPLY[@]} -eq 1 && "${COMPREPLY[0]}" != */ ]] && compopt +o nospace
            ;;
        services)
            compopt +o nospace
            COMPREPLY=($(compgen -W "--enabled --disabled -d" -- "$cur"))
            ;;
        *)
            compopt +o nospace
            COMPREPLY=($(compgen -W "start stop restart list info logs services orgs save enable disable show startup" -- "$cur"))
            ;;
    esac
}
complete -F _tsm_completion tsm

# Org completion - simple version that works before module is loaded
_org_completion() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local cmd="${COMP_WORDS[1]:-}"

    COMPREPLY=()

    # First argument - subcommands
    if [[ $COMP_CWORD -eq 1 ]]; then
        COMPREPLY=($(compgen -W "status list switch create init build sections alias unalias view edit section get set validate path env import pdata help" -- "$cur"))
        return
    fi

    # Second argument - context-specific
    case "$cmd" in
        switch|init|build|sections)
            local orgs_dir="$TETRA_DIR/orgs"
            if [[ -d "$orgs_dir" ]]; then
                local names=$(for d in "$orgs_dir"/*/; do [[ -d "$d" ]] && basename "$d"; done)
                COMPREPLY=($(compgen -W "$names" -- "$cur"))
            fi
            ;;
        import)
            COMPREPLY=($(compgen -W "nh list validate help" -- "$cur"))
            ;;
        pdata)
            COMPREPLY=($(compgen -W "status init" -- "$cur"))
            ;;
    esac
}
complete -F _org_completion org

tetra_create_lazy_function "tkm" "tkm"
tetra_create_lazy_function "tetra_python_activate" "python"
tetra_create_lazy_function "tetra_nvm_activate" "nvm"
tetra_create_lazy_function "tetra_ssh" "ssh"
tetra_create_lazy_function "tetra_sync" "sync"
tetra_create_lazy_function "tetra_deploy" "deploy"
tetra_create_lazy_function "tetra_git" "git"
tetra_create_lazy_function "tetra_nginx" "nginx"
tetra_create_lazy_function "pm" "pm"
tetra_create_lazy_function "tetra_service" "service"
tetra_create_lazy_function "tetra-self" "self"
tetra_create_lazy_function "tetra_tmux" "tmux"
tetra_create_lazy_function "tetra_user" "user"
tetra_create_lazy_function "hotrod" "hotrod"
tetra_create_lazy_function "tetra_ml" "ml"
tetra_create_lazy_function "pb" "pb"
tetra_create_lazy_function "pbvm" "pbvm"
tetra_create_lazy_function "pico" "pico"
tetra_create_lazy_function "tetra_svg" "svg"
tetra_create_lazy_function "tro" "tro"
tetra_create_lazy_function "anthropic" "anthropic"

# QA module functions - loaded directly in boot_core.sh (not lazy loaded)

# TDocs module functions
tetra_create_lazy_function "tdocs" "tdocs"

# Melvin module functions
tetra_create_lazy_function "melvin" "melvin"
tetra_create_lazy_function "melvin_repl" "melvin"
tetra_create_lazy_function "echo64" "melvin"

# Claude module functions
tetra_create_lazy_function "tetra_cc_send" "claude"
tetra_create_lazy_function "tetra_cc_loop" "claude"
tetra_create_lazy_function "tetra_cc_save" "claude"
tetra_create_lazy_function "tetra_cc_load" "claude"
tetra_create_lazy_function "tetra_cc_sessions" "claude"
tetra_create_lazy_function "tetra_cc_where" "claude"

# TView module functions
tetra_create_lazy_function "tview" "tview"

# Org module functions
tetra_create_lazy_function "tetra_org" "org"
tetra_create_lazy_function "org" "org"

# Vox module functions
tetra_create_lazy_function "vox" "vox"
tetra_create_lazy_function "v" "vox"
tetra_create_lazy_function "vr" "vox"

# Gamepak module functions (game package manager)
tetra_create_lazy_function "gamepak" "gamepak"

# MIDI module functions
tetra_create_lazy_function "midi" "midi"
tetra_create_lazy_function "midi_repl" "midi"

# TPerf module functions
tetra_create_lazy_function "tperf" "tperf"

# TDS module functions
tetra_create_lazy_function "tds" "tds"

# Chroma module functions
tetra_create_lazy_function "chroma" "chroma"

# MagicFind module functions (LLM-assisted file search)
# Command: mf  Alias: magicfind  Data: ~/tetra/magicfind/
tetra_create_lazy_function "mf" "magicfind"
tetra_create_lazy_function "magicfind" "magicfind"

# mf tab completion
_mf_completion() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local cmd="${COMP_WORDS[1]:-}"

    COMPREPLY=()

    # First argument - subcommands
    if [[ $COMP_CWORD -eq 1 ]]; then
        COMPREPLY=($(compgen -W "rules db list show replay search similar help" -- "$cur"))
        return
    fi

    # Context-specific completions
    case "$cmd" in
        rules)
            [[ $COMP_CWORD -eq 2 ]] && COMPREPLY=($(compgen -W "list add rm clear reset path" -- "$cur"))
            ;;
        db)
            [[ $COMP_CWORD -eq 2 ]] && COMPREPLY=($(compgen -W "stats clean path" -- "$cur"))
            ;;
    esac
}
complete -F _mf_completion mf
complete -F _mf_completion magicfind

