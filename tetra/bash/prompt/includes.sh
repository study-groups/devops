#!/usr/bin/env bash
# DEPRECATED: Use tps module instead
# This shim sources tps for backward compatibility

echo "prompt: deprecated, use 'tmod load tps'" >&2

source "$TETRA_SRC/bash/tps/includes.sh"
