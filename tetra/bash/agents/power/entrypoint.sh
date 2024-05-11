#!/usr/bin/env bash

echo "Bash version: $BASH_VERSION"
echo "Using bash: $(which bash)"
echo "PATH: $PATH"
echo "PWD: $PWD"
echo "TETRA_SRC: $TETRA_SRC"
echo "TETRA_DIR: $TETRA_DIR"
source $TETRA_SRC/bootstrap.sh 2>&1 /dev/null
delay=${1:-5}
echo "Starting loop to check uptime every $delay seconds..."


power_background_task() {
    while true; do
        now=$(date +%s%N)
        msg="$(uptime)"
        echo "$now UPTIME $msg"
        sleep $delay
    done
}

power_background_task &

create_index_html() {
    echo "<html><body><pre>" > index.html
    ps -ef | grep -E 'tmux|tetra_pm' >> index.html
    echo "</pre></body></html>" >> index.html
}

#trap 'bash' INT
while true; do
    create_index_html | nc -l  8000
done
