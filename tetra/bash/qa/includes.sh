#!/usr/bin/env bash

# QA Module Includes - Controls what gets loaded for QA functionality

# Source the main QA module
QA_MODULE_DIR="$(dirname "${BASH_SOURCE[0]}")"
source "$QA_MODULE_DIR/qa.sh"
