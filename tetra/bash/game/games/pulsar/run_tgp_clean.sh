#!/usr/bin/env bash
# Wrapper to run pulsar_tgp_repl.sh with clean environment
# This prevents exported function pollution

# Run in a completely clean subshell to avoid function export issues
exec env -i \
  HOME="$HOME" \
  PATH="$PATH" \
  TERM="$TERM" \
  TETRA_DIR="$TETRA_DIR" \
  TETRA_SRC="$TETRA_SRC" \
  bash -c 'source ~/tetra/tetra.sh && exec bash "$0" "$@"' \
  "$(dirname "$0")/pulsar_tgp_repl.sh" "$@"
