tetra_vault_encrypt() {
    local user=${1:-$TETRA_USER}
    local org=${2:-$TETRA_ORG}
    local user_dir="${TETRA_DIR}/users/${user}"
    local org_dir="${TETRA_DIR}/orgs/${org}"
    local tar_file="${user}_${org}_vault.tar"
    local enc_file="$TETRA_DIR/vault/${tar_file}.enc"

    # Check and create user directory if it doesn't exist
    if [ ! -d "$user_dir" ]; then
        echo "User directory does not exist. Creating: $user_dir"
        mkdir -p "$user_dir"
    fi

    # Check and create organization directory if it doesn't exist
    if [ ! -d "$org_dir" ]; then
        echo "Organization directory does not exist. Creating: $org_dir"
        mkdir -p "$org_dir"
    fi

    # Prompt for passphrase
    echo "Enter passphrase for encryption:"
    read -s passphrase

    passphrase="${passphrase}${TETRA_SALT}"

    # Change working directory to the parent directory of the user and org directories

(
    cd "${TETRA_DIR}"

    # Create a tar file of the specified directories
    echo "Creating tar file..."
    tar -cvf "${tar_file}" "users/${user}" "orgs/${org}"

    # Encrypt the tar file using the provided passphrase
    echo "Encrypting tar file..."
    openssl enc -aes-256-cbc \
 				-salt \
                -pbkdf2 \
				-iter 10000 \
				-in "${tar_file}" \
				-out "${enc_file}" \
				-pass pass:"${passphrase}"

    # Remove the original tar file
    rm "${tar_file}"
)

    echo "Vault file created at ${enc_file}"

}

tetra_vault_decrypt() {
    local vault_file=$1
    local tetra_dir=$TETRA_DIR

    # Prompt for passphrase
    echo "Enter passphrase for decryption:"
    read -s passphrase
    passphrase="${passphrase}${TETRA_SALT}"

    # Decrypt the vault file
    echo "Decrypting vault file..."
    openssl enc -d -aes-256-cbc -pbkdf2 -iter 10000 -in "${vault_file}" -out "${tetra_dir}/vault.tar" -pass pass:"${passphrase}"

    # Report actions to be taken
    echo "The following actions will be performed:"
    echo "- Extract static content from the decrypted vault file to ${tetra_dir}"
    echo "- Update user and organization directories"
    echo "- Update static files like API keys, SSH keys, etc."

    # Ask for confirmation
    read -p "Are you sure you want to proceed? (y/N) " confirmation
    if [[ "$confirmation" != "y" && "$confirmation" != "Y" ]]; then
        echo "Operation cancelled."
        return
    fi

    # List contents of the tar file before extracting
    echo "Listing contents of the vault file:"
    tar -tvf "${tetra_dir}/vault.tar"

    # Indicate where the files will be extracted
    echo "Extracting vault content to ${tetra_dir}..."

    # Perform actions
    echo "Extracting vault content..."
    tar -xvf "${tetra_dir}/vault.tar" -C "${tetra_dir}"
    rm "${tetra_dir}/vault.tar"

    echo "Updating directories and static files..."
    # Placeholder for actual update commands
}
