#!/usr/bin/env bash

echo "=== Testing NH Bootstrap Loading ==="

# Set required variables
export NH_SRC=/Users/mricos/src/devops/nh
export NH_DIR=/Users/mricos/nh
export DIGITALOCEAN_CONTEXT=pixeljam-arcade

echo "Variables set:"
echo "  NH_SRC=$NH_SRC"
echo "  NH_DIR=$NH_DIR"
echo "  DIGITALOCEAN_CONTEXT=$DIGITALOCEAN_CONTEXT"

echo ""
echo "Files that should be sourced:"
ls $NH_SRC/bash/*.sh | grep -v bootstrap.sh | grep -v basetrace.sh

echo ""
echo "Sourcing bootstrap..."
source $NH_SRC/bash/bootstrap.sh

echo ""
echo "Checking if functions are loaded:"
declare -f nh_load_env_vars >/dev/null && echo "✓ nh_load_env_vars loaded" || echo "✗ nh_load_env_vars missing"
declare -f nh_make_short_vars >/dev/null && echo "✓ nh_make_short_vars loaded" || echo "✗ nh_make_short_vars missing"

echo ""
echo "Testing nh_make_short_vars with pxjam prefix..."
nh_make_short_vars pxjam 2>/dev/null | head -3