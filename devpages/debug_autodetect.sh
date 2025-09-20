#!/usr/bin/env bash

source ../tetra/bash/tsm/tsm_core.sh

echo "=== Debug Auto-Detection ==="
script="entrypoints/devpages.sh"
explicit_env="dev"

echo "Input: script='$script', explicit_env='$explicit_env'"

# Debug the auto-detection step by step
script_dir="$(dirname "$script")"
project_root="$(dirname "$script_dir")"
auto_env="$project_root/env/${explicit_env}.env"

echo "script_dir: '$script_dir'"
echo "project_root: '$project_root'"
echo "auto_env: '$auto_env'"
echo "File test: [[ -f '$auto_env' ]]"

if [[ -f "$auto_env" ]]; then
    echo "✓ File exists!"
else
    echo "✗ File not found"
fi

echo -e "\nRunning full _tsm_auto_detect_env function:"
result="$(_tsm_auto_detect_env "$script" "$explicit_env" 2>&1)"
echo "Result: '$result'"
echo "Return code: $?"