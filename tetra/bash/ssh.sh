# Function to start ssh-agent if not already running
function tetra_ssh_start_agent() {
    if ! pgrep -x ssh-agent >/dev/null; then
        exec $(ssh-agent)
    fi
}

# Function to explain the role and functionality of ssh-agent
function tetra_ssh_explain_agent_functionality() {
    cat <<EOF
SSH-agent securely stores private keys, enabling single sign-on and key 
forwarding. It runs as a regular user, managing keys on their behalf. When 
started, ssh-agent creates a socket file in the user's home directory, acting 
as a secure communication channel. Additionally, it simplifies key management 
by automating authentication processes, particularly useful in automated 
scripts or when dealing with numerous servers.

Moreover, ssh-agent provides a convenient way to manage multiple SSH keys for 
various purposes. Users can add their keys to the agent, streamlining the 
authentication process and eliminating the need to repeatedly enter passphrases.
EOF
}

# Function to explain why ssh-agent is started using exec $(ssh-agent)
function tetra_ssh_explain_agent_startup() {
    cat <<EOF
The 'exec \$(ssh-agent)' syntax starts ssh-agent and replaces the current shell 
process. This ensures that ssh-agent is started in the context of the current 
shell session, preserving environment variables like SSH_AUTH_SOCK and 
SSH_AGENT_PID. Additionally, it ensures ssh-agent runs as a child process, 
simplifying management and termination when the shell exits. This tight 
integration enhances system security and stability.
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
    if [[ $# -ne 1 ]]; then
        echo "Usage: tetra_ssh_add <key_file>"
        return 1
    fi
    
    local key_file="$1"
    
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
    tetra_ssh_start_agent
    if pgrep -x ssh-agent >/dev/null; then
        echo "SSH Agent is running."
        echo "Keys added:"
        ssh-add -l
    else
        echo "SSH Agent is not running."
        echo "To start the SSH Agent, use 'tetra_ssh_start'."
    fi
}
