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
tetra_register_module "tdash" "$TETRA_BASH/tdash"
tetra_register_module "org" "$TETRA_BASH/org"
tetra_register_module "git" "$TETRA_BASH/git"
tetra_register_module "nginx" "$TETRA_BASH/nginx"
tetra_register_module "pm" "$TETRA_BASH/pm"
tetra_register_module "service" "$TETRA_BASH/service"
tetra_register_module "sys" "$TETRA_BASH/sys"
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

# Register internal modules for RAG and Melvin (qa registered in boot_core.sh)
tetra_register_module "rag" "$TETRA_BASH/rag"
tetra_register_module "melvin" "$TETRA_BASH/melvin"

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

# Melvin module functions
tetra_create_lazy_function "echo64" "melvin"

# Claude module functions
tetra_create_lazy_function "tetra_cc_send" "claude"
tetra_create_lazy_function "tetra_cc_loop" "claude"
tetra_create_lazy_function "tetra_cc_save" "claude"
tetra_create_lazy_function "tetra_cc_load" "claude"
tetra_create_lazy_function "tetra_cc_sessions" "claude"
tetra_create_lazy_function "tetra_cc_where" "claude"

# TDash module functions
tetra_create_lazy_function "tdash" "tdash"

# Org module functions
tetra_create_lazy_function "tetra_org" "org"

