tetra_ssh_add() {
    local key_file="";
    if [[ $# -ne 1 ]]; then
        key_file=$TETRA_DIR/data/$TETRA_REMOTE_USER/keys/id_rsa;
    else
        key_file="$1";
    fi;
    echo "Using current: tetra_ssh_add <key_file>";

    if [[ ! -f "$key_file" ]]; then
        echo "Error: Key file '$key_file' not found.";
        return 1;
    fi;

    tetra_ssh_start;

    if [ -z "$SSH_AUTH_SOCK" ]; then
        echo "Error: SSH_AUTH_SOCK not set. Check agent startup.";
        return 2;
    fi

    ssh-add "$key_file" && echo "Key '$key_file' added to ssh-agent." || echo "Failed to add key to ssh-agent."
}



# Function to provide information about SSH keys and ssh-agent
tetra_ssh_info() {
    tetra_ssh_start

    if pgrep -x ssh-agent >/dev/null; then
        echo "SSH Agent is running."
        echo "Keys added:"
        ssh-add -l
        echo "To add a new key, use 'tetra_ssh_add <key_file>'."
    else
        echo "SSH Agent is not running."
        echo "To start the SSH Agent, use 'tetra_ssh_start'."
    fi

    echo
}

function tetra_ssh_status() {
    if pgrep -x ssh-agent >/dev/null; then
        echo "SSH Agent is running."
        echo "Keys added:"
        ssh-add -l
    else
        echo "SSH Agent is not running."
        echo "To start the SSH Agent, use 'tetra_ssh_start'."
    fi
}
# Function to convert SSH id_rsa key to PEM file
function tetra_ssh_convert_to_pem() {
    if [[ $# -ne 1 ]]; then
        echo "Usage: tetra_ssh_convert_to_pem <id_rsa_file>"
        return 1
    fi
    
    local id_rsa_file="$1"
    local pem_file="${id_rsa_file%.pub}.pem"
    
    if [[ ! -f "$id_rsa_file" ]]; then
        echo "Error: id_rsa file '$id_rsa_file' not found."
        return 1
    fi
    
    if [[ -f "$pem_file" ]]; then
        echo "Error: PEM file '$pem_file' already exists."
        return 1
    fi
    
    ssh-keygen -f "$id_rsa_file" -e -m pem > "$pem_file"
    echo "PEM file '$pem_file' created from id_rsa file."
}
