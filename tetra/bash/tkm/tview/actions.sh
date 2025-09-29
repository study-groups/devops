#!/usr/bin/env bash

# TKM Actions - Standard TView Module Interface

# Standard interface: return actions for given environment
get_actions() {
    local env="$1"

    case "$env" in
        "TETRA")
            echo "ssh_overview:SSH Overview"
            echo "refresh:refresh"
            ;;
        "LOCAL")
            echo "edit_ssh_config:Edit SSH Config"
            echo "refresh:refresh"
            ;;
        "DEV")
            echo "test_ssh_dev:Test SSH"
            echo "refresh:refresh"
            ;;
        "STAGING")
            echo "test_ssh_staging:Test SSH"
            echo "refresh:refresh"
            ;;
        "PROD")
            echo "test_ssh_prod:Test SSH"
            echo "refresh:refresh"
            ;;
        *)
            echo "help:help"
            echo "refresh:refresh"
            ;;
    esac
}

# Standard interface: execute action for given environment
execute_action() {
    local action_id="$1"
    local env="$2"

    case "$action_id" in
        "ssh_overview")
            echo -e "\nFour Amigos SSH Access Matrix\n============================="
            echo "LOCAL: SSH status unknown"
            echo "DEV: SSH status unknown"
            echo "STAGING: SSH status unknown"
            echo "PROD: SSH status unknown"
            read -p "Press Enter to continue..."
            ;;
        "edit_ssh_config")
            ${EDITOR:-nano} ~/.ssh/config 2>/dev/null || echo "Could not open SSH config"
            ;;
        "test_ssh_"*)
            local target_env="${action_id#test_ssh_}"
            echo "Testing SSH connection to $target_env..."
            echo "SSH test for $target_env not implemented yet"
            read -p "Press Enter to continue..."
            ;;
        "refresh")
            echo "Refreshing TKM data..."
            ;;
        *)
            echo "TKM action '$action_id' not implemented"
            read -p "Press Enter to continue..."
            ;;
    esac
}