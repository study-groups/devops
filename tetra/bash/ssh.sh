
_reset_ssh_agent() {
    eval $(ssh-agent -s)
    echo "Agent started with PID $SSH_AGENT_PID"
    echo "SSH_AUTH_SOCK=$SSH_AUTH_SOCK"
    export SSH_AUTH_SOCK
}


tetra_ssh_add() {
    local key_file="";
    if [[ $# -ne 1 ]]; then
        key_file=$TETRA_DIR/users/$TETRA_USER/keys/id_rsa;
    else
        key_file="$1";
    fi;
    echo "Using current: tetra_ssh_add <key_file>";

    if [[ ! -f "$key_file" ]]; then
        echo "Error: Key file '$key_file' not found.";
        return 1;
    fi;

    tetra_ssh_start_agent;

    if [ -z "$SSH_AUTH_SOCK" ]; then
        echo "Error: SSH_AUTH_SOCK not set. Check agent startup.";
        return 2;
    fi

    ssh-add "$key_file" && echo "Key '$key_file' added to ssh-agent." || echo "Failed to add key to ssh-agent."
}

# Ensure to modify `tetra_ssh_start_agent`
# to export `SSH_AUTH_SOCK` explicitly
tetra_ssh_start_agent() {
   if ! pgrep -x ssh-agent > /dev/null; then
        eval $(ssh-agent -s);
        export SSH_AUTH_SOCK;
        echo "New SSH agent started with PID $SSH_AGENT_PID"
        echo "and Socket $SSH_AUTH_SOCK"
    else
        export SSH_AUTH_SOCK=$(find /tmp -type s -name "agent.*" 2>/dev/null \
	       |  head -n 1)
        echo "Using existing SSH agent with Socket $SSH_AUTH_SOCK"
    fi
}




# Explanation of improvements:
# 1. The script first checks for an existing ssh-agent and retrieves its PID.
# 2. It uses the first ssh-agent process found (if any) and sets up the SSH_AUTH_SOCK environment variable.
# 3. If no existing agent is found,



tetra_ssh_start_agent_DELETE() {
    if ! pgrep -x ssh-agent >/dev/null; then
        eval $(ssh-agent)
    fi
}

# Function to explain the role and functionality of ssh-agent
function tetra_ssh_explain_agent_functionality() {
    cat <<EOF
SSH-agent securely stores private keys, enabling single
sign-on and key forwarding. It runs as a regular user,
managing keys on their behalf. When started, ssh-agent
creates a socket file in the user's home directory,
acting as a secure communication channel. Additionally,
it simplifies key management by automating authentication
processes, particularly useful in automated scripts or
when dealing with numerous servers.

Moreover, ssh-agent provides a convenient way to manage
multiple SSH keys for various purposes. Users can add their
keys to the agent, streamlining the authentication process
and eliminating the need to repeatedly enter passphrases.
EOF
}

# Function to explain why ssh-agent is started using exec $(ssh-agent)
function tetra_ssh_explain_agent_startup() {
    cat <<EOF
The 'exec \$(ssh-agent)' syntax starts ssh-agent and
replaces the current shell process. This ensures that
ssh-agent is started in the context of the current
shell session, preserving environment variables like
SSH_AUTH_SOCK and SSH_AGENT_PID. Additionally, it
ensures ssh-agent runs as a child process, simplifying
management and termination when the shell exits. This
tight integration enhances system security and stability.
EOF
}

# Function to provide information about SSH keys and ssh-agent
function tetra_ssh_info() {
    tetra_ssh_start_agent

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
    echo "SSH Agent Functionality:"
    tetra_ssh_explain_agent_functionality
    echo
    echo "SSH Agent Startup:"
    tetra_ssh_explain_agent_startup
}

# Function to add a new SSH key
function tetra_ssh_add() {
    local key_file=""
    if [[ $# -ne 1 ]]; then
        key_file=$TETRA_DIR/users/$TETRA_USER/keys/id_rsa 
    else
        local key_file="$1"
	fi
    
    echo "Using current: tetra_ssh_add <key_file>"
    
    if [[ ! -f "$key_file" ]]; then
        echo "Error: Key file '$key_file' not found."
        return 1
    fi
    
    tetra_ssh_start_agent
    
    ssh-add "$key_file"
    echo "Key '$key_file' added to ssh-agent."
}

# Function to list added SSH keys
function tetra_ssh_list() {
    tetra_ssh_start_agent
    ssh-add -l
}

# Function to display status of SSH server
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
