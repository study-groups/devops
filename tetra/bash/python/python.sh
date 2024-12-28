# Set up the Tetra-specific PYENV_ROOT
export TETRA_DIR="${TETRA_DIR:-$HOME/tetra}"
export PYENV_ROOT="${PYENV_ROOT:-$TETRA_DIR/pyenv}"
export PATH="$PYENV_ROOT/bin:$PATH"

tetra_python_list_versions() {
    local base_url="https://www.python.org/ftp/python"

    echo "Fetching available Python versions..."

    # Fetch and parse available versions
    local available_versions
    available_versions=$(curl -sL "$base_url/" | grep -oP '(?<=<a href=")[0-9]+\.[0-9]+(\.[0-9]+)?(?=/)' | sort -V)

    # Check if any versions were found
    if [ -z "$available_versions" ]; then
        echo "No versions found. Please check your internet connection or the URL: $base_url"
        return 1
    fi

    # Define LTS versions 
    # (manually maintained based on Python.org announcements)
    local lts_versions=("3.9" "3.10" "3.11")

    # Determine the latest version
    local latest_version
    latest_version=$(echo "$available_versions" | tail -n 1)

    echo "Available Python versions:"
    echo

    # Annotate versions as LTS or Latest
    while read -r version; do
        local label=""
        # Check if this version is LTS
        for lts in "${lts_versions[@]}"; do
            if [[ "$version" == "$lts"* ]]; then
                label="LTS"
                break
            fi
        done
        # Mark the latest version
        if [[ "$version" == "$latest_version" ]]; then
            label="Latest"
        fi
        # Print the version with its label
        printf "%-10s %s\n" "$version" "$label"
    done <<< "$available_versions"
}

tetra_python_install_exact() {
    # Check if pyenv is installed and available in PATH
    if ! command -v pyenv &> /dev/null; then
        echo "Error: pyenv is not installed or not in PATH. Please install pyenv first."
        return 1
    fi

    # Ensure an exact version is provided
    if [ -z "$1" ]; then
        echo "Usage: tetra_python_install_exact <exact_version>"
        return 1
    fi

    # Define variables
    local exact_version="$1"
    local base_url="https://www.python.org/ftp/python"
    local tarball_url="$base_url/$exact_version/Python-$exact_version.tgz"
    local install_dir
    install_dir="$(pyenv root)/versions/$exact_version"

    # Check if the version is already installed
    if pyenv versions --bare | grep -q "^$exact_version$"; then
        echo "Python version $exact_version is already installed in pyenv."
        return 0
    fi

    # Download the tarball
    echo "Downloading Python $exact_version binary from $tarball_url..."
    if ! curl -o "/tmp/Python-$exact_version.tgz" "$tarball_url"; then
        echo "Error: Failed to download $tarball_url. Ensure the version exists or check your internet connection."
        return 1
    fi

    # Extract the tarball to pyenv versions directory
    echo "Installing Python $exact_version into $(pyenv root)..."
    mkdir -p "$install_dir"
    if ! tar -xzf "/tmp/Python-$exact_version.tgz" -C "$install_dir" --strip-components=1; then
        echo "Error: Failed to extract the tarball. Ensure the file is valid."
        rm -f "/tmp/Python-$exact_version.tgz"
        return 1
    fi
    rm -f "/tmp/Python-$exact_version.tgz"

    # Rehash pyenv to update shims
    pyenv rehash

    # Set the installed version as global
    pyenv global "$exact_version"

    # Initialize pyenv in the current session
    eval "$(pyenv init --path)"
    eval "$(pyenv init -)"

    # Verify the installation
    if python --version | grep -q "$exact_version"; then
        echo "Python $exact_version installed successfully and is now active."
    else
        echo "Error: Python $exact_version installation succeeded, but it's not active. Check your PATH or pyenv configuration."
        return 1
    fi
}


tetra_python_activate() {
    if [ -z "$PYENV_ROOT" ]; then
        echo "Error: PYENV_ROOT is not set."
        echo " Define it as the base directory for pyenv."
        return 1
    fi
    # Set PYENV_ROOT and update PATH
    export PYENV_ROOT="$TETRA_DIR/pyenv"
    export PATH="$PYENV_ROOT/bin:$PYENV_ROOT/shims:$PATH"

    # Initialize pyenv for the session
    if [ -x "$PYENV_ROOT/bin/pyenv" ]; then
        eval "$("$PYENV_ROOT/bin/pyenv" init --path)"
        eval "$("$PYENV_ROOT/bin/pyenv" init -)"
        local python_version
        python_version=$(pyenv version-name 2>/dev/null || echo "None")
        echo "Activating Python version/environment: $python_version"
        echo "pyenv base at $PYENV_ROOT and version $python_version"
    else
        echo "pyenv is not installed. Please run 'tetra_python_install_pyenv' first."
        return 1
    fi
}


tetra_python_install_pyenv() {
    if [ -z "$TETRA_DIR" ]; then
        echo "Error: TETRA_DIR is not set."; return 1
    fi

    [ -d "$PYENV_ROOT" ] && echo "Found existing at $PYENV_ROOT"

    export PYENV_ROOT="${PYENV_ROOT:-$TETRA_DIR/pyenv}"

    # Check if pyenv is already installed and functional
    if [ -x "$PYENV_ROOT/bin/pyenv" ] && \
        "$PYENV_ROOT/bin/pyenv" --version &>/dev/null; then
            echo "pyenv is already installed and functional at $PYENV_ROOT."
            return 0
    fi

    # Install pyenv in the custom PYENV_ROOT
    echo "Installing pyenv in $PYENV_ROOT..."
    curl -fsSL https://pyenv.run | bash

    # Check if installation succeeded
    if [ ! -x "$PYENV_ROOT/bin/pyenv" ]; then
        echo "pyenv installation failed."
        return 1
    fi

    echo "pyenv installed successfully at $PYENV_ROOT."

}



