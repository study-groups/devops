#!/bin/bash
keep_running="yes"

log(){
  echo "$(date -u +"%F_%T.%3NZ") ${@}"
}

cleanup() {
    log "Cleaning up, killing chidren"
    for child_pid in $(ps -o pid= --ppid $$); do
      log "$child_pid: $(cat /proc/$child_pid/cmdline)"
      kill -SIGTERM ${child_pid} 2>/dev/null
    done
    exit 0
}

info(){
  log "In the INT handler init"
  ps -ef $$ | while read pidinfo; do
    log "$pidinfo"
  done
}

trap cleanup SIGTERM
trap info INT

help(){
cat <<EOF
Using
ssh -o StrictHostKeyChecking=no\
    -i ${SSH_KEY} \
    -N -L *:${LOCAL_PORT}:${REMOTE_HOST}:${REMOTE_PORT} \
         ${SSH_USER}@${SSH_HOST} \
         2>&1 | tee >(cat - >&2) | cat -
EOF
}


ssh -o StrictHostKeyChecking=no\
    -i ${SSH_KEY} \
    -N -L *:${LOCAL_PORT}:${REMOTE_HOST}:${REMOTE_PORT} \
         ${SSH_USER}@${SSH_HOST} \
         2>&1 | tee out.txt &
SSH_PID=$! # Capture the process ID of the SSH command

while [[ $keep_running == "yes" ]]; do
  log "60 inner loops per 1 outer loop. SIGTERM to stop. "
  for i in $(seq 1 60); do
    if [[ $keep_running == "no" ]]; then
      break
    fi
    sleep 1
  done
done


# wait ${SSH_PID} # Wait for SSH process to terminate
echo "$(date -u +"%FT%T.%3NZ") adapter exiting"
