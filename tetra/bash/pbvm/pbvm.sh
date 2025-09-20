#!/usr/bin/env bash

# Set default PBVM_ROOT if not set
if [ -z "$PBVM_ROOT" ]; then
    export PBVM_ROOT="$HOME/.pbvm"
fi

export PBVM_VERSIONS="$PBVM_ROOT/versions"
export PBVM_ALIASES="$PBVM_ROOT/aliases"
export PBVM_CURRENT="$PBVM_ALIASES/current"
if [ "$VERBOSE" = "true" ]; then
    echo "PBVM_ROOT: $PBVM_ROOT"
    echo "PBVM_VERSIONS: $PBVM_VERSIONS"
    echo "PBVM_ALIASES: $PBVM_ALIASES"
    echo "PBVM_CURRENT: $PBVM_CURRENT"
fi

pbvm_get_latest_version() {
    local api_url="https://api.github.com/repos/pocketbase/pocketbase/releases/latest"
    local tag_name_pattern='"tag_name":'
    local version_extraction_pattern='s/.*"v([^"]+)".*/\1/'

    latest_version=$(curl -s "$api_url" \
        | grep "$tag_name_pattern" \
        | sed -E "$version_extraction_pattern")
    echo "$latest_version"
}

pbvm_get_latest_installed_version() {
    if [ -d "$PBVM_VERSIONS" ]; then
        local latest_version=$(ls -1 "$PBVM_VERSIONS" | sort -V | tail -n 1)
        echo "$latest_version"
    fi
}

pbvm_use() {
    local ver=$1
    if [ -z "$ver" ] || [ "$ver" == "latest" ]; then
        echo "No version specified or 'latest' specified. Attempting to use the latest installed version..."
        ver=$(pbvm_get_latest_installed_version)
        if [ -z "$ver" ]; then
            echo "Error: No versions installed."
            return 1
        fi
        echo "Using latest installed version: $ver"
    fi

    local version_dir="$PBVM_VERSIONS/$ver"

    if [ ! -d "$version_dir" ]; then
        echo "PocketBase version $ver is not installed."
        echo "PBVM environment variables:"
        printenv | grep PBVM_
        echo "You can install the latest version by running: pbvm install latest"
        return 1
    fi

    # Ensure the directory for the symbolic link exists
    mkdir -p "$PBVM_ALIASES"

    ln -sfn "$version_dir" "$PBVM_CURRENT"
    echo "Switched to PocketBase version $ver."

    # Add to PATH for the current session
    export PATH="$version_dir:$PATH"
    echo "PocketBase version $ver added to PATH for the current session."
}

generate_download_url() {
    local ver=$1
    local base_url="https://github.com/pocketbase/pocketbase/releases/download"
    local os_type="linux_amd64.zip"
    [[ "$OSTYPE" == "darwin"* ]] && os_type="darwin_amd64.zip"
    echo "$base_url/v${ver}/pocketbase_${ver}_${os_type}"
}

pbvm_download() {
    local ver=${1:-latest}
    if [ "$ver" == "latest" ]; then
        ver=$(pbvm_get_latest_version)
        if [ -z "$ver" ]; then
            echo "Error: Unable to fetch the latest version."
            return 1
        fi
        echo "Latest version is $ver"
    fi

    local download_url=$(generate_download_url "$ver")
    local version_dir="$PBVM_VERSIONS/$ver"

    [ -d "$version_dir" ] && {
        echo "PocketBase version $ver is already installed."; return; }

    mkdir -p "$version_dir"
    echo "Downloading PocketBase version $ver from $download_url..."
    curl -o /tmp/pocketbase.zip -L "$download_url" && \
    unzip /tmp/pocketbase.zip -d "$version_dir" && \
    rm /tmp/pocketbase.zip && \
    chmod +x "$version_dir/pocketbase" && \
    echo "PocketBase version $ver installed." && \
    pbvm_use "$ver"
}

pbvm_list_versions() {
    [ -d "$PBVM_VERSIONS" ] && ls "$PBVM_VERSIONS" || echo "No versions installed."
}

pbvm_status() {
    VERBOSE=${VERBOSE:-false}
    if [ -L "$PBVM_CURRENT" ]; then
        local current_version=$(basename "$(readlink -f "$PBVM_CURRENT")")
        local exe_path=$(readlink -f "$PBVM_CURRENT/pocketbase")
        local data_dir="$PBVM_CURRENT"
        local db_file="$data_dir/data.db"
        local logs_file="$data_dir/logs.db"
        local db_size="N/A"
        local logs_size="N/A"

        if [ -f "$db_file" ]; then
            db_size=$(du -h "$db_file" | cut -f1)
        fi

        if [ -f "$logs_file" ]; then
            logs_size=$(du -h "$logs_file" | cut -f1)
        fi
        if [ "$VERBOSE" = "true" ]; then
            echo "Database file: $db_file"
            echo "Database file size: $db_size"
            echo "Logs file: $logs_file"
            echo "Logs file size: $logs_size"
         echo "Executable path: $exe_path"
        echo "Data directory: $data_dir"
        fi
        echo "Current PocketBase version: $current_version"
        echo "PBVM_CURRENT: $PBVM_CURRENT"
        echo "Executable: $exe_path"

    else
        echo "No PocketBase version is currently in use."
    fi

if [ "$VERBOSE" = "true" ]; then
    echo "Verbose mode enabled. Displaying PBVM environment variables:"
    for var in $(printenv | grep PBVM_); do
        echo "$var"
    done
fi
}

pbvm_remove() {
    local ver=$1
    [ -z "$ver" ] && { echo "Usage: pbvm remove <version>"; return 1; }
    local version_dir="$PBVM_VERSIONS/$ver"
    [ ! -d "$version_dir" ] && { echo "Version $ver not installed."; return 1; }
    rm -rf "$version_dir" && echo "Version $ver removed."
}

pbvm() {
    case "$1" in
        install)
            pbvm_download "${2:-latest}"
            ;;
        remove)
            pbvm_remove "${2:-latest}"
            ;;
        use)
            pbvm_use "${2:-latest}"
            ;;
        list)
            pbvm_list_versions
            ;;
        status)
            pbvm_status
            ;;
        *)
            echo "Usage: pbvm {use|install|list|status} [version]"
            return 1
            ;;
    esac
}
