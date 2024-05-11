# Starts a new Jenkins session in tmux if it doesn't exist
tetra_jenkins_tmux_start () {
    if ! tmux has-session -t jenkins 2>/dev/null; then
        echo "Creating new Jenkins session in tmux and starting Jenkins..."
        tmux new-session -d -s jenkins "java -jar $JENKINS_WAR --httpPort=9090"
    else
        echo "Jenkins session already exists. Use join to attach."
    fi
}

# Joins an existing Jenkins session in tmux
tetra_jenkins_tmux_join () {
    if tmux has-session -t jenkins 2>/dev/null; then
        echo "Joining existing Jenkins session in tmux..."
        tmux attach -t jenkins
    else
        echo "No Jenkins session found. Use start to create one."
    fi
}

# Kills an existing Jenkins session in tmux
tetra_jenkins_tmux_kill () {
    if tmux has-session -t jenkins 2>/dev/null; then
        echo "Killing the Jenkins session..."
        tmux kill-session -t jenkins
    else
        echo "No Jenkins session found to kill."
    fi
}

