tetra_help_ssh_agent() {
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

tetra_help_ssh_agent_startup() {
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
