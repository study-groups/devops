#!/bin/bash
# Environment Reporting

process_env_report() {
    echo "Environment Variables Report"
    echo "----------------------------"

    # Check and report TETRA_SRC
    if [ -z "$TETRA_SRC" ]; then
        echo "TETRA_SRC: Not defined"
    else
        echo "TETRA_SRC: $TETRA_SRC"
    fi

    # Check and report TETRA_DIR
    if [ -z "$TETRA_DIR" ]; then
        echo "TETRA_DIR: Not defined"
    else
        echo "TETRA_DIR: $TETRA_DIR"
    fi

    # Check and report NVM_DIR
    if [ -z "$NVM_DIR" ]; then
        echo "NVM_DIR: Not defined"
    else
        echo "NVM_DIR: $NVM_DIR"
    fi

    # Check and report PD_DIR
    if [ -z "$PD_DIR" ]; then
        echo "PD_DIR: Not defined"
    else
        echo "PD_DIR: $PD_DIR"
    fi

    # Report which node
    node_path=$(which node)
    if [ -z "$node_path" ]; then
        echo "which node: Not found"
    else
        echo "which node: $node_path"
    fi

    echo ""
} 