#!/usr/bin/env bash
# Spaces Module TCS-Compliant Actions
# Follows Tetra Module Convention 2.0 and TCS 3.0

# Import spaces functionality
: "${SPACES_SRC:=$TETRA_SRC/bash/spaces}"
source "$SPACES_SRC/spaces.sh" 2>/dev/null || true

# Register spaces actions with TUI
spaces_register_actions() {
    # Ensure declare_action exists
    if ! declare -f declare_action >/dev/null 2>&1; then
        echo "Warning: declare_action not available" >&2
        return 1
    fi

    # List objects in bucket
    declare_action "list_objects" \
        "verb=list" \
        "noun=objects" \
        "exec_at=@spaces" \
        "contexts=Remote" \
        "modes=Inspect" \
        "tes_operation=@spaces" \
        "inputs=bucket,path" \
        "output=@tui[content]" \
        "immediate=true" \
        "can=List objects in DigitalOcean Spaces bucket" \
        "cannot=Modify objects"

    # Upload file to spaces
    declare_action "upload_file" \
        "verb=upload" \
        "noun=file" \
        "exec_at=@spaces" \
        "contexts=Remote" \
        "modes=Execute" \
        "tes_operation=@spaces" \
        "inputs=local_path,bucket,remote_path" \
        "output=@tui[status]" \
        "effects=@spaces[object/created]" \
        "immediate=false" \
        "can=Upload files to Spaces bucket" \
        "cannot=Delete or modify existing files"

    # Download file from spaces
    declare_action "download_file" \
        "verb=download" \
        "noun=file" \
        "exec_at=@spaces" \
        "contexts=Remote" \
        "modes=Execute" \
        "tes_operation=@spaces" \
        "inputs=bucket,remote_path,local_path" \
        "output=@tui[status]" \
        "effects=@local[file/created]" \
        "immediate=false" \
        "can=Download files from Spaces bucket" \
        "cannot=Modify remote files"

    # Sync directory to spaces
    declare_action "sync_directory" \
        "verb=sync" \
        "noun=directory" \
        "exec_at=@spaces" \
        "contexts=Remote" \
        "modes=Execute" \
        "tes_operation=@spaces" \
        "inputs=local_dir,bucket,remote_dir" \
        "output=@tui[status]" \
        "effects=@spaces[objects/synced]" \
        "immediate=false" \
        "can=Sync local directory to Spaces" \
        "cannot=Delete files not in sync source"

    # Configure Spaces credentials
    declare_action "configure_credentials" \
        "verb=configure" \
        "noun=credentials" \
        "exec_at=@local" \
        "contexts=Local" \
        "modes=Configure" \
        "tes_operation=local" \
        "inputs=access_key,secret_key,region" \
        "output=@tui[status]" \
        "effects=@local[config/updated]" \
        "immediate=true" \
        "can=Configure DigitalOcean Spaces credentials" \
        "cannot=Access existing credentials"
}

# Execute spaces actions
spaces_execute_action() {
    local action="$1"
    shift
    local args=("$@")

    case "$action" in
        list:objects)
            local bucket="${args[0]}"
            local path="${args[1]:-}"

            if [[ -z "$bucket" ]]; then
                echo "Error: bucket required"
                return 1
            fi

            spaces_list "$bucket" "$path"
            ;;

        upload:file)
            local local_path="${args[0]}"
            local bucket="${args[1]}"
            local remote_path="${args[2]}"

            if [[ -z "$local_path" || -z "$bucket" || -z "$remote_path" ]]; then
                echo "Error: local_path, bucket, and remote_path required"
                return 1
            fi

            spaces_upload "$local_path" "$bucket" "$remote_path"
            ;;

        download:file)
            local bucket="${args[0]}"
            local remote_path="${args[1]}"
            local local_path="${args[2]}"

            if [[ -z "$bucket" || -z "$remote_path" || -z "$local_path" ]]; then
                echo "Error: bucket, remote_path, and local_path required"
                return 1
            fi

            spaces_download "$bucket" "$remote_path" "$local_path"
            ;;

        sync:directory)
            local local_dir="${args[0]}"
            local bucket="${args[1]}"
            local remote_dir="${args[2]}"

            if [[ -z "$local_dir" || -z "$bucket" || -z "$remote_dir" ]]; then
                echo "Error: local_dir, bucket, and remote_dir required"
                return 1
            fi

            spaces_sync "$local_dir" "$bucket" "$remote_dir"
            ;;

        configure:credentials)
            local access_key="${args[0]}"
            local secret_key="${args[1]}"
            local region="${args[2]:-nyc3}"

            if [[ -z "$access_key" || -z "$secret_key" ]]; then
                echo "Error: access_key and secret_key required"
                return 1
            fi

            spaces_configure "$access_key" "$secret_key" "$region"
            ;;

        *)
            echo "Unknown action: $action"
            return 1
            ;;
    esac
}

export -f spaces_register_actions
export -f spaces_execute_action
