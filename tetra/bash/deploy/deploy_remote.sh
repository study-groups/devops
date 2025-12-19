#!/usr/bin/env bash
# deploy_remote.sh - DEPRECATED
#
# This module's functionality has been consolidated:
#   - deploy_push(), deploy_show() -> deploy.sh
#   - TOML parsing -> _deploy_toml_get() in includes.sh, de_load() in deploy_engine.sh
#   - Template expansion -> _deploy_template_core() in includes.sh
#
# Kept for backwards compatibility but no longer exports any functions.
# TODO: Remove this file and update includes.sh once confirmed no external deps

# Legacy state variables (may be referenced by external code)
TETRA_LOCAL_DIR=""
TETRA_REMOTE_DIR=""
declare -gA TARGET=()
declare -gA ENVS=()
