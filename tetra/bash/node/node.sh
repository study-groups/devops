tetra_node_install() {
    # Install Node.js 22.x LTS on Ubuntu Linux using Nodesource official script
    set -e

    NODE_VERSION="22"

    # Update package index
    sudo apt-get update

    # Install prerequisites
    sudo apt-get install -y curl ca-certificates

    # Download and execute Nodesource setup script for Node.js 22.x
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -

    # Install Node.js and npm
    sudo apt-get install -y nodejs

    # Verify installation
    node -v
    npm -v
}
