#!/usr/bin/env bash

# tetra_node_install()
#
# Automates the installation of a Cilium Tetragon node on Ubuntu.
#
# Usage:
#   1. Source this script: . ./your_script_name.sh
#   2. Run the function: tetra_node_install

tetra_tetragon_install() {
  set -e

  # Install dependencies
  sudo apt-get update
  sudo apt-get install -y curl gpg

  # Add Cilium GPG key and repository
  GPG_KEY_PATH="/usr/share/keyrings/cilium-archive-keyring.gpg"
  curl -fsSL https://raw.githubusercontent.com/cilium/cilium/main/install/kubernetes/cilium.gpg | sudo gpg --dearmor -o "${GPG_KEY_PATH}"
  echo "deb [signed-by=${GPG_KEY_PATH}] https://raw.githubusercontent.com/cilium/cilium/main/stable/deb/any/ any main" | \
    sudo tee /etc/apt/sources.list.d/cilium.list

  # Install Tetragon
  sudo apt-get update
  sudo apt-get install -y tetragon

  # Enable and start the Tetragon service
  sudo systemctl enable --now tetragon

  echo "✅ Tetragon installation complete. Service status:"
  sudo systemctl status tetragon --no-pager
}

# Example of how to call the function after sourcing the script:
# tetra_node_install
