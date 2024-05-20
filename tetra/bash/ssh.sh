tetra_ssh_kill(){
  eval "$(ssh-agent -k)"
}


# Function to start the ssh-agent
tetra_ssh_start() {
    if ! pgrep -u "$USER" ssh-agent > /dev/null; then
        echo "Starting a new SSH agent..."
        eval "$(ssh-agent -s)" > /dev/null
        if [ -z "$SSH_AUTH_SOCK" ] || [ -z "$SSH_AGENT_PID" ]; then
            echo "Error: Failed to start ssh-agent."
            return 1
        fi
        echo "SSH_AUTH_SOCK=$SSH_AUTH_SOCK"
        echo "SSH_AGENT_PID=$SSH_AGENT_PID"
        echo "export SSH_AUTH_SOCK=$SSH_AUTH_SOCK" > ~/.ssh/agent_env
        echo "export SSH_AGENT_PID=$SSH_AGENT_PID" >> ~/.ssh/agent_env
        echo "SSH agent started and environment variables written to ~/.ssh/agent_env"
    else
        echo "SSH agent is already running."
        if [ -f ~/.ssh/agent_env ]; then
            source ~/.ssh/agent_env
            if [ -z "$SSH_AUTH_SOCK" ] || [ -z "$SSH_AGENT_PID" ]; then
                echo "Error: ~/.ssh/agent_env does not contain valid environment variables."
                eval "$(ssh-agent -s)" > /dev/null
                echo "export SSH_AUTH_SOCK=$SSH_AUTH_SOCK" > ~/.ssh/agent_env
                echo "export SSH_AGENT_PID=$SSH_AGENT_PID" >> ~/.ssh/agent_env
                source ~/.ssh/agent_env
                echo "New SSH agent environment variables written to ~/.ssh/agent_env"
            else
                echo "Using existing SSH agent with Socket $SSH_AUTH_SOCK"
            fi
        else
            echo "No agent environment file found. Creating new one."
            eval "$(ssh-agent -s)" > /dev/null
            echo "export SSH_AUTH_SOCK=$SSH_AUTH_SOCK" > ~/.ssh/agent_env
            echo "export SSH_AGENT_PID=$SSH_AGENT_PID" >> ~/.ssh/agent_env
            source ~/.ssh/agent_env
        fi
    fi
}

# Function to check if SSH agent environment variables are set
check_ssh_agent() {
    if [ -z "$SSH_AUTH_SOCK" ] || [ -z "$SSH_AGENT_PID" ]; then
        echo "No SSH agent environment found. Please start the agent using tetra_ssh_start."
        return 1
    fi
    return 0
}

# Function to list the keys added to the ssh-agent
tetra_ssh_list() {
    check_ssh_agent
    if [ $? -ne 0 ]; then
        return 1
    fi

    echo "Using existing SSH agent with Socket $SSH_AUTH_SOCK"
    ssh-add -l
}

# Function to add multiple SSH keys to ssh-agent
tetra_ssh_add_many() {
    local key_dir=$1

    check_ssh_agent
    if [ $? -ne 0 ]; then
        return 1
    fi

    echo "Adding keys from directory: $key_dir"

    # Add valid SSH private keys to the ssh-agent
    for key in "$key_dir"/*; do
        echo "Processing file: $key"
        
        # Skip public key files
        if [[ "$key" =~ \.pem$ || "$key" =~ \.pub$ ]]; then
            echo "Skipping file: $key (public or pem)"
            continue
        fi

        # Check if the file contains a private key header
        if grep -q "PRIVATE KEY" "$key"; then
            echo "Attempting to add key: $key"
            ssh-add "$key"
            if [[ $? -eq 0 ]]; then
                echo "Successfully added $key"
            else
                echo "Failed to add $key"
            fi
        else
            echo "Skipping file: $key (not a valid private key)"
        fi
    done

    # List the keys currently added to the ssh-agent
    echo "Listing keys added to ssh-agent:"
    ssh-add -l
}

# Source the ssh-agent environment if it exists
if [ -f ~/.ssh/agent_env ]; then
    source ~/.ssh/agent_env
fi


